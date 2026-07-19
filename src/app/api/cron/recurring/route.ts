import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { AccountingEntry } from "@/models/schema";
import { lineService } from "@/services/line.service";
import { getAllLineUserIds } from "@/lib/userRegistry";
import { computeInstallment } from "@/utils/loan";

/**
 * 處理定期支出與貸款每月扣款
 * Vercel Cron: 5 16 * * * (UTC) -> 台灣時間 00:05
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

    try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const currentDayOfWeek = now.getDay(); // 0-6 (Sun-Sat)
        const currentDayOfMonth = now.getDate(); // 1-31
        const currentMonth = now.getMonth() + 1; // 1-12

        // 判斷今天是否為該月最後一天 (處理 29, 30, 31 號的邊界情況)
        const isLastDayOfMonth = new Date(now.getFullYear(), currentMonth, 0).getDate() === currentDayOfMonth;

        const results: Array<{ userId: string; triggeredCount: number }> = [];

        for (const userId of userIds) {
            const recurringSnap = await db.collection("recurring_expenses")
                .where("userId", "==", userId)
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
                    // 寫入 accounting（帶 userId）
                    const entry: AccountingEntry = {
                        userId,
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

            // 貸款每月扣款：等額本息，只有利息寫入 accounting 當支出，本金攤還只減少貸款餘額
            const loansSnap = await db.collection("loans")
                .where("userId", "==", userId)
                .where("status", "==", "active")
                .get();

            for (const doc of loansSnap.docs) {
                const data = doc.data();
                const { name, annualRate, dayOfMonth, monthlyPayment, remainingPrincipal, paidInstallments, termMonths, lastTriggeredAt } = data;

                if (lastTriggeredAt === todayStr) {
                    continue;
                }

                let shouldTrigger = dayOfMonth === currentDayOfMonth;
                if (!shouldTrigger && isLastDayOfMonth && typeof dayOfMonth === "number" && dayOfMonth > currentDayOfMonth) {
                    shouldTrigger = true;
                }

                if (!shouldTrigger) {
                    continue;
                }

                const isLastInstallment = paidInstallments + 1 >= termMonths;
                const { interestPortion, principalPortion } = computeInstallment(
                    remainingPrincipal,
                    annualRate,
                    monthlyPayment,
                    isLastInstallment
                );

                if (interestPortion > 0) {
                    const entry: AccountingEntry = {
                        userId,
                        amount: interestPortion,
                        tag: "Loan",
                        description: `${name} 利息 [貸款]`,
                        date: todayStr,
                        source: "system",
                        originalText: `System: loan ${doc.id}`,
                        createdAt: new Date(),
                    };
                    await db.collection("accounting").add(entry);
                }

                await doc.ref.update({
                    remainingPrincipal: Math.max(0, remainingPrincipal - principalPortion),
                    paidInstallments: paidInstallments + 1,
                    lastTriggeredAt: todayStr,
                    ...(isLastInstallment ? { status: "settled" } : {}),
                });

                triggeredList.push(`- $${interestPortion} [Loan] ${name} 利息（本金 -$${principalPortion}）`);
            }

            // 有觸發才推播給當前用戶
            if (triggeredList.length > 0) {
                await lineService.pushText(userId, [
                    "🔄 定期支出已入帳",
                    "━━━━━━━━━━━━",
                    ...triggeredList
                ].join("\n"));
            }

            results.push({ userId, triggeredCount: triggeredList.length });
        }

        return NextResponse.json({ status: "ok", results });
    } catch (error) {
        console.error("[cron-recurring] Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
