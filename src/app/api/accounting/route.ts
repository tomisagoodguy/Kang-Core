import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db as adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { TagEnum, PaymentMethodEnum, SettlementSchema } from "@/models/schema";
import type { AccountingEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { computeCurrencyFields } from "@/utils/currency";
import { TravelModeService } from "@/services/travelMode.service";
import { ClassificationEngine } from "@/services/classificationEngine";

export async function GET(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const tag = searchParams.get("tag");

        // 用「等值 + date 範圍、無 orderBy」查詢：Firestore 會自動合併單欄索引（zigzag merge），
        // 不需複合索引（專案的複合索引從未部署成功，orderBy 會直接 FAILED_PRECONDITION）。
        // 以近 400 天為下限界定資料量，排序與截斷在 JS 端做，確保拿到的是「最新」而非隨機文件。
        const dateFloor = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
        const snapshot = await adminDb
            .collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", dateFloor)
            .get();

        // tag 過濾在 JS 端做：再加一個等值條件就需要複合索引（本專案索引未部署）
        const entries: AccountingEntryView[] = snapshot.docs
            .filter((doc) => !tag || tag === "all" || doc.data().tag === tag)
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt:
                        data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : data.createdAt ?? null,
                } as AccountingEntryView;
            })
            .sort((a, b) => {
                const dateCmp = (b.date ?? "").localeCompare(a.date ?? "");
                if (dateCmp !== 0) return dateCmp;
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            })
            .slice(0, limit);

        return NextResponse.json({ entries, total: entries.length });
    } catch (error) {
        console.error("[API/accounting] Error:", error);
        return NextResponse.json({ error: "Failed to fetch accounting data" }, { status: 500 });
    }
}

const CreateEntrySchema = z.object({
    amount: z.number().positive(),
    tag: TagEnum,
    subTag: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().optional(),
    currency: z.string().optional(), // ISO 4217，未填視為 TWD
    paymentMethod: PaymentMethodEnum.optional(),
    creditCardId: z.string().optional(),
    settlement: SettlementSchema.optional(),
});

export async function POST(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const parsed = CreateEntrySchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
        }
        const input = parsed.data;

        // 旅遊模式進行中且幣別相同 → 沿用啟動時匯率；否則即時抓（含 fallback）
        const travelState = await TravelModeService.getState(userId).catch(() => null);
        const { currency, exchangeRate, amountTWD } = await computeCurrencyFields(
            input.amount,
            input.currency ?? "TWD",
            travelState,
        );

        const createdAt = new Date();
        const entry = {
            userId,
            amount: input.amount,
            tag: input.tag,
            date: input.date,
            description: input.description ?? "",
            originalText: `[Web] ${input.description || input.tag} ${input.amount} ${currency}`,
            source: "manual",
            createdAt,
            currency,
            exchangeRate,
            amountTWD,
            ...(input.subTag ? { subTag: input.subTag } : {}),
            ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
            ...(input.creditCardId ? { creditCardId: input.creditCardId } : {}),
            ...(input.settlement ? { settlement: input.settlement } : {}),
        };

        const ref = await adminDb.collection("accounting").add(entry);

        // 寫入成功後才學習分類規則（非同步不等待）
        if (input.description && input.tag !== "Other") {
            ClassificationEngine.learn(input.description, input.tag, userId, input.subTag, true).catch(() => {});
        }

        return NextResponse.json({
            entry: { ...entry, id: ref.id, createdAt: createdAt.toISOString() },
        }, { status: 201 });
    } catch (error) {
        console.error("[API/accounting/POST] Error:", error);
        return NextResponse.json({ error: "Failed to create accounting entry" }, { status: 500 });
    }
}
