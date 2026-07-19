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
import type { AccountingEntry } from "@/models/schema";

/**
 * 財政部電子發票 Gmail 自動記帳。
 *
 * 流程：Gmail 搜尋彙整信 → 下載 CSV/TXT/ZIP 附件 → 三層去重 → 解析 → 分類 → 寫入 accounting。
 * 去重（皆以 Firestore doc.create() 搶鎖，ALREADY_EXISTS 即跳過）：
 *   1. 信件層：processed_invoices/msg_{messageId}（整封信處理成功後標記，下次直接跳過）
 *   2. 附件層：processed_invoices/att_{sha256}（同內容附件重寄不重複處理）
 *   3. 發票層：processed_invoices/inv_{發票號碼}_{日期}（同張發票出現在多封彙整信不重複入帳）
 */

const DEFAULT_QUERY =
    'has:attachment newer_than:60d {subject:"消費發票彙整通知" subject:"消費資訊" filename:csv filename:zip filename:txt}';

export interface ImportedInvoice {
    invoiceNumber: string;
    date: string; // YYYY-MM-DD
    merchantName: string;
    amount: number;
    tag: string;
    /** 同日已有相同金額的手動記帳，可能重複，需人工確認 */
    suspectedDuplicate: boolean;
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
async function classify(invoice: ParsedInvoice, userId: string): Promise<{ tag: string; subTag?: string }> {
    const text = [invoice.merchantName, ...invoice.items.slice(0, 5).map((i) => i.name)].join(" ");
    const matched = await ClassificationEngine.match(text, userId);
    if (matched) return matched;
    return { tag: guessTag(text) };
}

/** 同日同金額的非系統來源記帳 → 疑似與手動記帳重複（仍入帳，但通知提醒） */
async function hasSuspectedManualDuplicate(userId: string, date: string, amount: number): Promise<boolean> {
    const snap = await db.collection("accounting")
        .where("userId", "==", userId)
        .where("date", "==", date)
        .get();
    return snap.docs.some((doc) => {
        const data = doc.data();
        if (data.source === "einvoice" || data.source === "system") return false;
        const entryAmount = typeof data.amountTWD === "number" ? data.amountTWD : data.amount;
        return Math.round(entryAmount) === Math.round(amount);
    });
}

async function importInvoice(invoice: ParsedInvoice, userId: string): Promise<ImportedInvoice | null> {
    const date = invoice.issuedAt.slice(0, 10);
    const lockId = `inv_${invoice.invoiceNumber}_${date}`;
    const acquired = await acquireLock(lockId, {
        userId,
        invoiceNumber: invoice.invoiceNumber,
        date,
        amount: invoice.totalAmount,
    });
    if (!acquired) return null;

    const { tag, subTag } = await classify(invoice, userId);
    const suspectedDuplicate = await hasSuspectedManualDuplicate(userId, date, invoice.totalAmount);

    const itemSummary = invoice.items.slice(0, 3).map((i) => i.name).join("、");
    const entry: AccountingEntry = {
        userId,
        amount: invoice.totalAmount,
        tag: tag as AccountingEntry["tag"],
        ...(subTag ? { subTag } : {}),
        date,
        description: itemSummary ? `${invoice.merchantName}（${itemSummary}）` : invoice.merchantName,
        source: "einvoice",
        invoiceNumber: invoice.invoiceNumber,
        originalText: `E-invoice ${invoice.invoiceNumber} ${invoice.merchantName} $${invoice.totalAmount}`,
        createdAt: new Date(),
    };
    await db.collection("accounting").add(entry);

    return {
        invoiceNumber: invoice.invoiceNumber,
        date,
        merchantName: invoice.merchantName,
        amount: invoice.totalAmount,
        tag,
        suspectedDuplicate,
    };
}

/** 同步指定用戶的電子發票信件（Gmail 帳號 = GOOGLE_OAUTH_REFRESH_TOKEN 授權帳號） */
export async function syncEinvoices(userId: string): Promise<InvoiceSyncResult> {
    const query = process.env.GMAIL_INVOICE_QUERY?.trim() || DEFAULT_QUERY;
    const messageIds = await listMessageIds(query, 50);

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
                        const imported = await importInvoice(invoice, userId);
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

    return result;
}
