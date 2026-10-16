import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { myExpenseTWD } from "@/utils/currency";
import type { AccountingEntry } from "@/models/schema";

/**
 * 按月 × 分類聚合支出（排除 Income），可選 keyword 追蹤特定主題（例如「約會」）跨分類的月支出。
 * keyword 比對 description / subTag / originalText——LINE 記帳的 originalText 保留使用者原句，
 * 即使 Gemini 把描述改寫掉，關鍵字仍能命中，舊資料也適用。
 */
export async function GET(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const months = Math.max(1, Math.min(36, Number(searchParams.get("months")) || 12));
        const keyword = (searchParams.get("keyword") ?? "").trim().slice(0, 30);

        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
        const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-01`;

        const snapshot = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", cutoffStr)
            .get();

        const monthKeys: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        const tagBuckets = new Map<string, Record<string, number>>();
        const keywordBuckets = new Map<string, { amount: number; count: number }>();
        monthKeys.forEach((m) => {
            tagBuckets.set(m, {});
            keywordBuckets.set(m, { amount: 0, count: 0 });
        });
        const tagTotals: Record<string, number> = {};
        const needle = keyword.toLowerCase();

        snapshot.docs.forEach((doc) => {
            const entry = doc.data() as AccountingEntry;
            if (entry.tag === "Income") return;
            const monthKey = entry.date.slice(0, 7);
            const tags = tagBuckets.get(monthKey);
            if (!tags) return;
            const amount = myExpenseTWD(entry);
            tags[entry.tag] = (tags[entry.tag] ?? 0) + amount;
            tagTotals[entry.tag] = (tagTotals[entry.tag] ?? 0) + amount;

            if (needle) {
                const haystack = `${entry.description ?? ""} ${entry.subTag ?? ""} ${entry.originalText ?? ""}`.toLowerCase();
                if (haystack.includes(needle)) {
                    const kb = keywordBuckets.get(monthKey)!;
                    kb.amount += amount;
                    kb.count += 1;
                }
            }
        });

        const rows = monthKeys.map((month) => {
            const tags = tagBuckets.get(month)!;
            const rounded: Record<string, number> = {};
            Object.entries(tags).forEach(([t, v]) => { rounded[t] = Math.round(v); });
            const kb = keywordBuckets.get(month)!;
            return { month, tags: rounded, keywordAmount: Math.round(kb.amount), keywordCount: kb.count };
        });

        // 依期間總額排序，前端預設勾選前幾名
        const tagsByTotal = Object.entries(tagTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, total]) => ({ tag, total: Math.round(total) }));

        return NextResponse.json({ months: rows, tagsByTotal, keyword: keyword || null });
    } catch (error) {
        console.error("GET /api/dashboard/tag-trend error:", error);
        return NextResponse.json({ error: "Failed to fetch tag trend" }, { status: 500 });
    }
}
