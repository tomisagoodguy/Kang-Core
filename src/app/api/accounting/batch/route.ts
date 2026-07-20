import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db as adminDb } from "@/lib/firebase/admin";
import { TagEnum, PaymentMethodEnum, SettlementSchema } from "@/models/schema";
import type { AccountingEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { computeCurrencyFields } from "@/utils/currency";
import { TravelModeService } from "@/services/travelMode.service";
import { ClassificationEngine } from "@/services/classificationEngine";

const BatchEntrySchema = z.object({
    amount: z.number().positive(),
    tag: TagEnum,
    subTag: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().optional(),
    currency: z.string().optional(),
    paymentMethod: PaymentMethodEnum.optional(),
    settlement: SettlementSchema.optional(),
});

const BatchSchema = z.object({
    entries: z.array(BatchEntrySchema).min(1).max(50), // 單次上限 50 筆，避免誤貼超大檔案卡住 batch write
});

/**
 * 批次新增記帳：一次送出多筆，單一 Firestore batch 寫入，全部失敗或全部成功。
 * 供 Dashboard「批次新增」（例如貼上一整個月的明細）使用；LINE 仍走原有單則/多則解析路徑。
 */
export async function POST(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const parsed = BatchSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
        }

        const travelState = await TravelModeService.getState(userId).catch(() => null);
        const batch = adminDb.batch();
        const createdAt = new Date();
        const entries: AccountingEntryView[] = [];
        const learnQueue: Array<{ text: string; tag: string; subTag?: string }> = [];

        for (const input of parsed.data.entries) {
            const { currency, exchangeRate, amountTWD } = await computeCurrencyFields(
                input.amount,
                input.currency ?? "TWD",
                travelState,
            );

            const docRef = adminDb.collection("accounting").doc();
            const entry = {
                userId,
                amount: input.amount,
                tag: input.tag,
                date: input.date,
                description: input.description ?? "",
                originalText: `[Web 批次] ${input.description || input.tag} ${input.amount} ${currency}`,
                source: "manual" as const,
                createdAt,
                currency,
                exchangeRate,
                amountTWD,
                ...(input.subTag ? { subTag: input.subTag } : {}),
                ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
                ...(input.settlement ? { settlement: input.settlement } : {}),
            };

            batch.set(docRef, entry);
            entries.push({ ...entry, id: docRef.id, createdAt: createdAt.toISOString() } as AccountingEntryView);

            if (input.description && input.tag !== "Other") {
                learnQueue.push({ text: input.description, tag: input.tag, subTag: input.subTag });
            }
        }

        await batch.commit();

        // 寫入成功後才學習分類規則，避免整批失敗時仍污染訓練資料
        for (const item of learnQueue) {
            ClassificationEngine.learn(item.text, item.tag, userId, item.subTag, true).catch(() => {});
        }

        return NextResponse.json({ entries, count: entries.length }, { status: 201 });
    } catch (error) {
        console.error("[API/accounting/batch/POST] Error:", error);
        return NextResponse.json({ error: "Failed to create accounting entries" }, { status: 500 });
    }
}
