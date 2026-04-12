import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { generateFinancialInsights } from "@/services/insights";
import { getAllLineUserIds } from "@/lib/userRegistry";

/**
 * 每月月報推播
 * Vercel Cron: 0 1 1 * * (UTC) → 每月 1 日 09:00 UTC+8
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getAllLineUserIds();
    if (userIds.length === 0) {
        return NextResponse.json({ error: "LINE_USER_IDS not set" }, { status: 500 });
    }

    const now = new Date();
    // 上個月範圍
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const from = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
    const to = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthLabel = `${lastMonthYear}/${String(lastMonth + 1).padStart(2, "0")}`;

    // 上上月範圍
    const prevMonth = lastMonth === 0 ? 11 : lastMonth - 1;
    const prevMonthYear = lastMonth === 0 ? lastMonthYear - 1 : lastMonthYear;
    const prevFrom = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
    const prevLastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    const prevTo = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;

    const tagEmoji: Record<string, string> = {
        Food: "🍽", Transport: "🚗", Entertainment: "🎬", Utilities: "💡",
        Shopping: "🛒", Health: "🏥", Education: "📚", Insurance: "🛡️", Subscription: "🔖", Investment: "📈", Other: "📦",
    };

    const results: Array<{ userId: string; total: number }> = [];

    for (const userId of userIds) {
        try {
            // 上月消費
            const snap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", from)
                .where("date", "<=", to)
                .get();

            const entries = snap.docs.map((d) => d.data());
            const total = entries.reduce((s, e) => s + ((e.amount as number) || 0), 0);

            // 上上月消費（對比用）
            const prevSnap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", prevFrom)
                .where("date", "<=", prevTo)
                .get();

            const prevTotal = prevSnap.docs.reduce((s, d) => s + ((d.data().amount as number) || 0), 0);

            // 月增減
            let comparison = "";
            if (prevTotal > 0) {
                const diff = ((total - prevTotal) / prevTotal * 100).toFixed(1);
                const arrow = total > prevTotal ? "📈" : "📉";
                comparison = `\n${arrow} 相較上月: ${total > prevTotal ? "+" : ""}${diff}%`;
            }

            // 標籤統計
            const tagMap = new Map<string, number>();
            entries.forEach((e) => {
                const tag = (e.tag as string) || "Other";
                tagMap.set(tag, (tagMap.get(tag) || 0) + ((e.amount as number) || 0));
            });

            const tagLines = Array.from(tagMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([tag, amt]) => {
                    const pct = total > 0 ? Math.round(amt / total * 100) : 0;
                    return `${tagEmoji[tag] || "📦"} ${tag}: $${amt.toLocaleString()} (${pct}%)`;
                });

            // Top 3 最高單筆
            const top3 = entries
                .sort((a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0))
                .slice(0, 3)
                .map((e, i) => `${i + 1}. $${((e.amount as number) || 0).toLocaleString()} - ${(e.description as string) || "—"}`);

            // AI 洞察
            const insight = await generateFinancialInsights(userId);

            await lineService.pushText(userId, [
                `📊 ${monthLabel} 月報`,
                "━━━━━━━━━━━━",
                `📝 共 ${entries.length} 筆消費`,
                `💰 總支出: $${total.toLocaleString()}`,
                comparison,
                "",
                "🏷 分類佔比",
                ...tagLines.slice(0, 5),
                "",
                "🏆 消費 Top 3",
                ...top3,
                "",
                "🧠 AI 顧問建議",
                "━━━━━━━━━━━━",
                insight,
            ].join("\n"));

            results.push({ userId, total });
        } catch (err) {
            console.error(`[monthly-report] Error for user ${userId}:`, err);
        }
    }

    return NextResponse.json({ status: "ok", monthLabel, results });
}
