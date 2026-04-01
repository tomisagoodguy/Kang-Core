import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { getTagEmoji } from "@/utils/tagEmoji";
import { getAllLineUserIds } from "@/lib/userRegistry";

/**
 * 每日消費摘要推播
 * Vercel Cron: 0 13 * * * (UTC) → 21:00 UTC+8
 */
export async function GET(req: Request) {
    // 驗證 Cron 密鑰
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getAllLineUserIds();
    if (userIds.length === 0) {
        return NextResponse.json({ error: "LINE_USER_IDS not set" }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const results: Array<{ userId: string; todayTotal: number; monthTotal: number }> = [];

    for (const userId of userIds) {
        try {
            // 今日消費
            const todaySnap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", "==", today)
                .get();

            // 今日數據
            const todayEntries = todaySnap.docs.map((d) => d.data());
            const todayIncome = todayEntries.filter(e => e.tag === "Income").reduce((s, e) => s + ((e.amount as number) || 0), 0);
            const todayExpense = todayEntries.filter(e => e.tag !== "Income").reduce((s, e) => s + ((e.amount as number) || 0), 0);
            const todayBalance = todayIncome - todayExpense;

            // 本月數據
            const monthSnap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", monthStart)
                .where("date", "<=", today)
                .get();

            const monthEntries = monthSnap.docs.map(d => d.data());
            const monthIncome = monthEntries.filter(e => e.tag === "Income").reduce((s, e) => s + ((e.amount as number) || 0), 0);
            const monthExpense = monthEntries.filter(e => e.tag !== "Income").reduce((s, e) => s + ((e.amount as number) || 0), 0);
            const monthBalance = monthIncome - monthExpense;

            // 標籤統計
            const tagMap = new Map<string, number>();
            todayEntries.forEach((e) => {
                const tag = (e.tag as string) || "Other";
                tagMap.set(tag, (tagMap.get(tag) || 0) + ((e.amount as number) || 0));
            });

            const tagLines = Array.from(tagMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([tag, amt]) => `${getTagEmoji(tag)} ${tag}: $${amt.toLocaleString()}`);

            if (todayEntries.length === 0) {
                await lineService.pushText(userId, [
                    "📊 今日消費摘要",
                    "━━━━━━━━━━━━",
                    "🎉 今天零收支記錄！",
                    "",
                    `📅 本月結餘: $${monthBalance.toLocaleString()}`,
                    `📈 收入: $${monthIncome.toLocaleString()}`,
                    `📉 支出: $${monthExpense.toLocaleString()}`,
                ].join("\n"));
            } else {
                await lineService.pushText(userId, [
                    "📊 今日消費摘要",
                    "━━━━━━━━━━━━",
                    `💰 今日筆數: ${todayEntries.length} 筆`,
                    `⚖️ 當日結餘: $${todayBalance.toLocaleString()}`,
                    ...tagLines,
                    "",
                    `📅 本月結餘: $${monthBalance.toLocaleString()}`,
                    `📈 收入: $${monthIncome.toLocaleString()}`,
                    `📉 支出: $${monthExpense.toLocaleString()}`,
                ].join("\n"));
            }

            results.push({ userId, todayTotal: todayBalance, monthTotal: monthBalance });
        } catch (err) {
            console.error(`[daily-summary] Error for user ${userId}:`, err);
        }
    }

    return NextResponse.json({ status: "ok", results });
}
