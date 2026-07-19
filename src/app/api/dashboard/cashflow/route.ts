import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { myExpenseTWD } from "@/utils/currency";
import type { AccountingEntry } from "@/models/schema";

/** 按月聚合 Income/Expense/淨現金流，純讀取既有 accounting 資料，不落地新集合 */
export async function GET(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const months = Math.max(1, Math.min(24, Number(searchParams.get("months")) || 12));

        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const snapshot = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", cutoffStr)
            .get();

        // 產生近 N 個月的月份清單，確保沒有資料的月份也回傳 0 而非被省略
        const monthKeys: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        const buckets = new Map<string, { income: number; expense: number }>();
        monthKeys.forEach((m) => buckets.set(m, { income: 0, expense: 0 }));

        snapshot.docs.forEach((doc) => {
            const entry = doc.data() as AccountingEntry;
            const monthKey = entry.date.slice(0, 7);
            const bucket = buckets.get(monthKey);
            if (!bucket) return; // 理論上不會發生（已用 cutoff 過濾），保底略過
            if (entry.tag === "Income") {
                bucket.income += entry.amountTWD ?? entry.amount;
            } else {
                bucket.expense += myExpenseTWD(entry);
            }
        });

        const result = monthKeys.map((month) => {
            const b = buckets.get(month)!;
            return { month, income: Math.round(b.income), expense: Math.round(b.expense), net: Math.round(b.income - b.expense) };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET /api/dashboard/cashflow error:", error);
        return NextResponse.json({ error: "Failed to fetch cashflow" }, { status: 500 });
    }
}
