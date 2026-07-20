import { createHash } from "crypto";
import { db } from "@/lib/firebase/admin";
import {
    getInvoiceAttachmentRefs,
    getAttachmentBytes,
    listMessageIds,
} from "@/lib/gmail/client";
import { extractInvoiceDocuments, parseEinvoiceText, type ParsedInvoice } from "@/lib/einvoice/parser";
import { ClassificationEngine } from "@/services/classificationEngine";
import { guessTag } from "@/services/quickCommand";
import { normalizeMerchant } from "@/utils/merchant";
import type { EinvoiceRecord, InvoiceMember } from "@/models/schema";

/**
 * 財政部電子發票 Gmail 自動匯入（家庭帳）。
 *
 * 全家共用同一載具，發票**不進個人 accounting**，落地獨立的 `einvoice_records` 集合，
 * 個人統計（儲蓄率／預算／月報）完全不受影響。成員歸屬（我／爸／媽）依序判定：
 *   1. auto-match：同日同額對到我的手動記帳 → member="me" 並連結該筆
 *   2. rule：`einvoice_member_rules` 商家歸屬規則（Dashboard 指定過一次即學會）
 *   3. 未歸屬（null）→ Dashboard 手動指定後寫回規則
 *
 * 三層去重（processed_invoices 集合，doc.create() 搶鎖）：
 *   信件層 msg_{messageId} / 附件層 att_{sha256} / 發票層 inv_{發票號碼}_{日期}
 */

const DEFAULT_QUERY =
    'has:attachment newer_than:60d {subject:"消費發票彙整通知" subject:"消費資訊" filename:csv filename:zip filename:txt}';

export interface ImportedInvoice {
    invoiceNumber: string;
    date: string; // YYYY-MM-DD
    merchantName: string;
    amount: number;
    tag: string;
    member: InvoiceMember | null;
}

export interface InvoiceSyncResult {
    messages: number;
    attachments: number;
    imported: ImportedInvoice[];
    duplicates: number;
    errors: string[];
}

/** doc.create() 搶鎖；已存在回傳 false */
async function acquireLock(docId: string, payload: Record<string, unknown>): Promise<boolean> {
    try {
        await db.collection("processed_invoices").doc(docId).create({
            ...payload,
            createdAt: new Date(),
        });
        return true;
    } catch (e: unknown) {
        const error = e as { code?: number; message?: string };
        if (error.code === 6 || error.message?.includes("ALREADY_EXISTS")) {
            return false;
        }
        throw e;
    }
}

/** 分類：學習規則 → 靜態關鍵字兜底 → Other */
async function classify(merchantName: string, itemNames: string[], userId: string): Promise<{ tag: string; subTag?: string }> {
    const text = [merchantName, ...itemNames.slice(0, 5)].join(" ");
    const matched = await ClassificationEngine.match(text, userId);
    if (matched) return matched;
    return { tag: guessTag(text) };
}

/** 成員歸屬規則快取（cron 單次執行內有效） */
async function loadMemberRules(userId: string): Promise<Map<string, InvoiceMember>> {
    const snap = await db.collection("einvoice_member_rules")
        .where("userId", "==", userId)
        .get();
    const rules = new Map<string, InvoiceMember>();
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.merchantKey && data.member) rules.set(data.merchantKey, data.member);
    }
    return rules;
}

/**
 * 同日同額比對我的手動記帳（source 非 einvoice/system）。
 * 對到 → 這筆發票是我本人消費（member="me"），並連結該筆手動帳避免重複計算的疑慮。
 */
async function matchManualEntry(userId: string, date: string, amount: number): Promise<string | null> {
    const snap = await db.collection("accounting")
        .where("userId", "==", userId)
        .where("date", "==", date)
        .get();
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.source === "einvoice" || data.source === "system") continue;
        const entryAmount = typeof data.amountTWD === "number" ? data.amountTWD : data.amount;
        if (Math.round(entryAmount) === Math.round(amount)) return doc.id;
    }
    return null;
}

async function importInvoice(
    invoice: ParsedInvoice,
    userId: string,
    memberRules: Map<string, InvoiceMember>
): Promise<ImportedInvoice | null> {
    const date = invoice.issuedAt.slice(0, 10);
    const lockId = `inv_${invoice.invoiceNumber}_${date}`;
    const acquired = await acquireLock(lockId, {
        userId,
        invoiceNumber: invoice.invoiceNumber,
        date,
        amount: invoice.totalAmount,
    });
    if (!acquired) return null;

    const itemNames = invoice.items.map((i) => i.name);
    const { tag } = await classify(invoice.merchantName, itemNames, userId);

    // 成員歸屬：先比對手動帳（me），再套商家規則
    let member: InvoiceMember | null = null;
    let memberSource: EinvoiceRecord["memberSource"];
    let matchedAccountingEntryId: string | undefined;

    const matchedId = await matchManualEntry(userId, date, invoice.totalAmount);
    if (matchedId) {
        member = "me";
        memberSource = "auto-match";
        matchedAccountingEntryId = matchedId;
    } else {
        const ruleMember = memberRules.get(normalizeMerchant(invoice.merchantName));
        if (ruleMember) {
            member = ruleMember;
            memberSource = "rule";
        }
    }

    const itemSummary = itemNames.slice(0, 3).join("、");
    const record: EinvoiceRecord = {
        userId,
        invoiceNumber: invoice.invoiceNumber,
        date,
        merchantName: invoice.merchantName,
        ...(invoice.sellerTaxId ? { sellerTaxId: invoice.sellerTaxId } : {}),
        amount: invoice.totalAmount,
        tag: tag as EinvoiceRecord["tag"],
        ...(itemSummary ? { description: itemSummary } : {}),
        member,
        ...(memberSource ? { memberSource } : {}),
        ...(matchedAccountingEntryId ? { matchedAccountingEntryId } : {}),
        createdAt: new Date(),
    };
    await db.collection("einvoice_records").add(record);

    return {
        invoiceNumber: invoice.invoiceNumber,
        date,
        merchantName: invoice.merchantName,
        amount: invoice.totalAmount,
        tag,
        member,
    };
}

/**
 * 回溯比對：把仍未歸屬的發票重新對一輪手動記帳。
 * 補「發票先匯入、使用者晚點才手動記帳」的時序漏洞——「我」認得越準，
 * 剩餘（爸媽生活共同體）的消費輪廓就越準。
 */
export async function retroMatchUnassigned(userId: string): Promise<number> {
    const snap = await db.collection("einvoice_records")
        .where("userId", "==", userId)
        .where("member", "==", null)
        .get();

    let matched = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const matchedId = await matchManualEntry(userId, data.date, data.amount);
        if (matchedId) {
            await doc.ref.update({
                member: "me",
                memberSource: "auto-match",
                matchedAccountingEntryId: matchedId,
            });
            matched += 1;
        }
    }
    return matched;
}

/** 同步電子發票信件（Gmail 帳號 = GOOGLE_OAUTH_REFRESH_TOKEN 授權帳號） */
export async function syncEinvoices(userId: string): Promise<InvoiceSyncResult> {
    const query = process.env.GMAIL_INVOICE_QUERY?.trim() || DEFAULT_QUERY;
    const messageIds = await listMessageIds(query, 50);
    const memberRules = await loadMemberRules(userId);

    const result: InvoiceSyncResult = {
        messages: 0,
        attachments: 0,
        imported: [],
        duplicates: 0,
        errors: [],
    };

    for (const messageId of messageIds) {
        // 信件層去重：處理過的信直接跳過，不再打 Gmail API 抓附件
        const msgDoc = await db.collection("processed_invoices").doc(`msg_${messageId}`).get();
        if (msgDoc.exists) continue;

        result.messages += 1;
        let messageFullyProcessed = true;

        try {
            const refs = await getInvoiceAttachmentRefs(messageId);
            for (const ref of refs) {
                try {
                    const bytes = await getAttachmentBytes(messageId, ref);
                    const hash = createHash("sha256").update(bytes).digest("hex");

                    const acquired = await acquireLock(`att_${hash}`, {
                        userId,
                        messageId,
                        filename: ref.filename,
                    });
                    if (!acquired) {
                        result.duplicates += 1;
                        continue;
                    }
                    result.attachments += 1;

                    const documents = extractInvoiceDocuments(ref.filename, bytes);
                    const parsed = documents.flatMap((doc) => parseEinvoiceText(doc.text));
                    for (const invoice of parsed) {
                        const imported = await importInvoice(invoice, userId, memberRules);
                        if (imported) result.imported.push(imported);
                        else result.duplicates += 1;
                    }
                } catch (e) {
                    messageFullyProcessed = false;
                    result.errors.push(
                        `附件 ${ref.filename}：${e instanceof Error ? e.message : "處理失敗"}`
                    );
                }
            }
        } catch (e) {
            messageFullyProcessed = false;
            result.errors.push(
                `信件 ${messageId}：${e instanceof Error ? e.message : "讀取失敗"}`
            );
        }

        // 全部附件處理成功才標記整封信完成；失敗的下次 cron 重試（附件/發票層鎖保證不重複入帳）
        if (messageFullyProcessed) {
            await acquireLock(`msg_${messageId}`, { userId });
        }
    }

    // 回溯比對：撿回「發票先進、手動帳後補」的漏網之魚
    try {
        await retroMatchUnassigned(userId);
    } catch (e) {
        result.errors.push(`回溯比對失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    }

    return result;
}
