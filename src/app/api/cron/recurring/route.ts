import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { AccountingEntry } from "@/models/schema";
import { lineService } from "@/services/line.service";

/**
 * 處理定期支出
 * Vercel Cron: 5 16 * * * (UTC) -> 台灣時間 00:05
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const currentDayOfWeek = now.getDay(); // 0-6 (Sun-Sat)
        const currentDayOfMonth = now.getDate(); // 1-31
        const currentMonth = now.getMonth() + 1; // 1-12

        // 判斷今天是否為該月最後一天 (處理 29, 30, 31 號的邊界情況)
        const isLastDayOfMonth = new Date(now.getFullYear(), currentMonth, 0).getDate() === currentDayOfMonth;

        const recurringSnap = await db.collection("recurring_expenses")
            .where("isActive", "==", true)
            .get();

        const triggeredList: string[] = [];

        for (const doc of recurringSnap.docs) {
            const data = doc.data();
            const { frequency, dayOfMonth, dayOfWeek, monthOfYear, lastTriggeredAt, amount, tag, description } = data;

            // 防重複觸發
            if (lastTriggeredAt === todayStr) {
                continue;
            }

            let shouldTrigger = false;

            if (frequency === "daily") {
                shouldTrigger = true;
            } else if (frequency === "weekly") {
                if (dayOfWeek === currentDayOfWeek) {
                    shouldTrigger = true;
                }
            } else if (frequency === "monthly") {
                if (dayOfMonth === currentDayOfMonth) {
                    shouldTrigger = true;
                } else if (isLastDayOfMonth && typeof dayOfMonth === "number" && dayOfMonth > currentDayOfMonth) {
                    // 例如設定 31 號，但該月只有 30 天，就會在 30 號（當月最後一天）觸發
                    shouldTrigger = true;
                }
            } else if (frequency === "yearly") {
                if (monthOfYear === currentMonth && dayOfMonth === currentDayOfMonth) {
                    shouldTrigger = true;
                } else if (monthOfYear === currentMonth && isLastDayOfMonth && typeof dayOfMonth === "number" && dayOfMonth > currentDayOfMonth) {
                    shouldTrigger = true;
                }
            }

            if (shouldTrigger) {
                // 寫入 accounting
                const entry: AccountingEntry = {
                    amount,
                    tag,
                    description: `${description} [定期]`,
                    date: todayStr,
                    source: "system",
                    originalText: `System: recurring ${doc.id}`,
                    createdAt: new Date(),
                };

                await db.collection("accounting").add(entry);

                // 更新 recurring_expenses
                await doc.ref.update({
                    lastTriggeredAt: todayStr,
                });

                triggeredList.push(`- $${amount} [${tag}] ${description}`);
            }
        }

        // 如果有觸發且設定 LINE_USER_ID，主動推播通知 (可選)
        const userId = process.env.LINE_USER_ID;
        if (triggeredList.length > 0 && userId) {
            await lineService.pushText(userId, [
                "🔄 定期支出已入帳",
                "━━━━━━━━━━━━",
                ...triggeredList
            ].join("\n"));
        }

        return NextResponse.json({ status: "ok", triggeredCount: triggeredList.length });
    } catch (error) {
        console.error("[cron-recurring] Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
