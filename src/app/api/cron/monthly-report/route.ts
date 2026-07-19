import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { generateFinancialInsights } from "@/services/insights";
import { getAllLineUserIds } from "@/lib/userRegistry";
import { myExpenseTWD } from "@/utils/currency";
import { updateBiasMultiplier } from "@/utils/forecast";

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
        Shopping: "🛒", Health: "🏥", Education: "📚", Insurance: "🛡️", Subscription: "🔖", Investment: "📈", Travel: "✈️", Loan: "🏦", Other: "📦",
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

            const allEntries = snap.docs.map((d) => d.data());
            const entries = allEntries.filter((e) => e.tag !== "Income");
            const total = entries.reduce((s, e) => s + myExpenseTWD(e), 0);

            // 上上月消費（對比用，同樣排除 Income）
            const prevSnap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", prevFrom)
                .where("date", "<=", prevTo)
                .get();

            const prevTotal = prevSnap.docs
                .filter((d) => d.data().tag !== "Income")
                .reduce((s, d) => s + myExpenseTWD(d.data()), 0);

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
                tagMap.set(tag, (tagMap.get(tag) || 0) + myExpenseTWD(e));
            });

            const tagLines = Array.from(tagMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([tag, amt]) => {
                    const pct = total > 0 ? Math.round(amt / total * 100) : 0;
                    return `${tagEmoji[tag] || "📦"} ${tag}: $${amt.toLocaleString()} (${pct}%)`;
                });

            // Top 3 最高單筆
            const top3 = entries
                .sort((a, b) => myExpenseTWD(b) - myExpenseTWD(a))
                .slice(0, 3)
                .map((e, i) => `${i + 1}. $${myExpenseTWD(e).toLocaleString()} - ${(e.description as string) || "—"}`);

            // 校準預測公式：拿上月最後一筆快照的「變動支出預測」跟實際結果比對，調整未來的校準係數
            try {
                const lastMonthYearMonth = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}`;
                const snapQuery = await db.collection("forecast_snapshots")
                    .where("userId", "==", userId)
                    .where("monthYear", "==", lastMonthYearMonth)
                    .orderBy("date", "desc")
                    .limit(1)
                    .get();

                if (!snapQuery.empty) {
                    const lastSnapshot = snapQuery.docs[0].data();
                    const recurringActual = entries
                        .filter((e) => e.source === "system")
                        .reduce((s, e) => s + myExpenseTWD(e), 0);
                    const actualVariable = total - recurringActual;
                    // 快照當天預測的「本月全部變動支出」= 已花費 + 剩餘天數推估
                    const predictedVariableTotal = lastSnapshot.variableSoFar + lastSnapshot.variableProjectionRemaining;

                    if (predictedVariableTotal > 0) {
                        const errorRatio = actualVariable / predictedVariableTotal;
                        const calibrationRef = db.collection("forecast_calibration").doc(userId);
                        const calibrationDoc = await calibrationRef.get();
                        const prevBias = (calibrationDoc.data()?.biasMultiplier as number | undefined) ?? 1;
                        const prevSampleCount = (calibrationDoc.data()?.sampleCount as number | undefined) ?? 0;
                        const lastCalibratedMonth = calibrationDoc.data()?.lastCalibratedMonth as string | undefined;

                        // 避免同一個月被重複校準（例如 cron 被手動重跑）
                        if (lastCalibratedMonth !== lastMonthYearMonth) {
                            await calibrationRef.set({
                                userId,
                                biasMultiplier: updateBiasMultiplier(prevBias, errorRatio),
                                sampleCount: prevSampleCount + 1,
                                lastCalibratedMonth: lastMonthYearMonth,
                                updatedAt: new Date().toISOString(),
                            });
                        }
                    }
                }
            } catch (calibrationErr) {
                console.error(`[monthly-report] forecast calibration failed for user ${userId}:`, calibrationErr);
            }

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
