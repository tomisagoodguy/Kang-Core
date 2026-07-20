import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/auth/withAuth";
import { InvoiceMemberEnum, TagEnum } from "@/models/schema";
import { normalizeMerchant } from "@/utils/merchant";
import { ClassificationEngine } from "@/services/classificationEngine";

const UpdateSchema = z.object({
    member: InvoiceMemberEnum.nullable().optional(),
    tag: TagEnum.optional(),
    /** member 指定時是否同步寫入商家歸屬規則（預設 true，之後同商家自動歸屬） */
    learnRule: z.boolean().default(true),
});

/**
 * PUT /api/einvoice/[id]
 * 更新發票的成員歸屬或分類。手動指定 member 時預設學習商家規則。
 */
export const PUT = withAuth(async (req, userId) => {
    const id = new URL(req.url).pathname.split("/").pop();
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "格式錯誤" }, { status: 400 });
    }
    const { member, tag, learnRule } = parsed.data;

    const ref = db.collection("einvoice_records").doc(id);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.userId !== userId) {
        return NextResponse.json({ error: "找不到資料" }, { status: 404 });
    }
    const record = doc.data()!;

    const updates: Record<string, unknown> = {};
    if (member !== undefined) {
        updates.member = member;
        updates.memberSource = member === null ? null : "manual";
    }
    if (tag !== undefined) {
        updates.tag = tag;
        // 分類修正回饋給學習引擎（與個人帳同一套規則，之後自動分對）
        await ClassificationEngine.learn(record.merchantName, tag, userId, undefined, true);
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "沒有可更新的欄位" }, { status: 400 });
    }
    await ref.update(updates);

    // 商家歸屬規則：同商家（正規化後）之後自動歸給同一位成員
    if (member && learnRule) {
        const merchantKey = normalizeMerchant(record.merchantName);
        if (merchantKey) {
            const ruleId = `${userId}_${Buffer.from(merchantKey).toString("base64url").slice(0, 60)}`;
            await db.collection("einvoice_member_rules").doc(ruleId).set({
                userId,
                merchantKey,
                member,
                updatedAt: new Date(),
            }, { merge: true });
        }
    }

    return NextResponse.json({ status: "ok", id, ...updates });
});
