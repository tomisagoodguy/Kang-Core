import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import type { AccountingEntry, CreditCard, CreditCardBill } from "@/models/schema";
import { lineService } from "@/services/line.service";
import { getAllLineUserIds } from "@/lib/userRegistry";
import { myExpenseTWD } from "@/utils/currency";

/**
 * 信用卡帳單週期：出帳日當天自動彙整該期刷卡消費，產生 credit_card_bills 待繳帳單
 * Vercel Cron: 10 16 * * * (UTC) -> 台灣時間 00:10（緊接在定期支出 cron 之後）
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
        const todayStr = now.toISOString().slice(0, 10);
        const currentDayOfMonth = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const isLastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate() === currentDayOfMonth;

        const results: Array<{ userId: string; billsCreated: number }> = [];

        for (const userId of userIds) {
            const cardsSnap = await db.collection("credit_cards")
                .where("userId", "==", userId)
                .where("isActive", "==", true)
                .get();

            if (cardsSnap.empty) {
                results.push({ userId, billsCreated: 0 });
                continue;
            }

            const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CreditCard & { id: string }));
            const singleCardId = cards.length === 1 ? cards[0].id : null;
            const createdBills: string[] = [];

            for (const card of cards) {
                const shouldTrigger =
                    card.billingDay === currentDayOfMonth ||
                    (isLastDayOfMonth && card.billingDay > currentDayOfMonth);
                if (!shouldTrigger) continue;

                // 冪等：今天已經產生過這期帳單就跳過（避免同日重複觸發的 cron 重跑）
                const dupSnap = await db.collection("credit_card_bills")
                    .where("creditCardId", "==", card.id)
                    .where("periodEnd", "==", todayStr)
                    .limit(1)
                    .get();
                if (!dupSnap.empty) continue;

                // 找上一期帳單，periodStart = 上期 periodEnd 隔天；沒有上期則從卡片建立日開始
                const priorSnap = await db.collection("credit_card_bills")
                    .where("creditCardId", "==", card.id)
                    .get();
                const priorEnds = priorSnap.docs.map(d => (d.data() as CreditCardBill).periodEnd).sort();
                const lastPeriodEnd = priorEnds[priorEnds.length - 1];
                const periodStart = lastPeriodEnd
                    ? new Date(new Date(lastPeriodEnd).getTime() + 86400000).toISOString().slice(0, 10)
                    : (card.createdAt instanceof Date ? card.createdAt : new Date(card.createdAt as unknown as string)).toISOString().slice(0, 10);
                const periodEnd = todayStr;

                const accSnap = await db.collection("accounting")
                    .where("userId", "==", userId)
                    .where("date", ">=", periodStart)
                    .where("date", "<=", periodEnd)
                    .get();
                const entries = accSnap.docs
                    .map(d => d.data() as AccountingEntry)
                    .filter(e => e.paymentMethod === "credit_card")
                    .filter(e => e.creditCardId ? e.creditCardId === card.id : e.creditCardId === undefined && singleCardId === card.id);
                const totalAmount = entries.reduce((s, e) => s + myExpenseTWD(e), 0);

                // 繳款日：出帳日之後最近的 dueDay（若 dueDay 早於出帳日，代表落在次月）
                const dueMonthOffset = card.dueDay > card.billingDay ? 0 : 1;
                const dueMonthDate = new Date(currentYear, currentMonth - 1 + dueMonthOffset, 1);
                const dueDaysInMonth = new Date(dueMonthDate.getFullYear(), dueMonthDate.getMonth() + 1, 0).getDate();
                const dueDay = Math.min(card.dueDay, dueDaysInMonth);
                const dueDate = new Date(dueMonthDate.getFullYear(), dueMonthDate.getMonth(), dueDay).toISOString().slice(0, 10);

                await db.collection("credit_card_bills").add({
                    userId,
                    creditCardId: card.id,
                    periodStart,
                    periodEnd,
                    dueDate,
                    totalAmount,
                    paidAmount: 0,
                    status: "unpaid",
                    createdAt: new Date(),
                });

                createdBills.push(`- ${card.name}: $${totalAmount.toLocaleString()}（${dueDate} 前繳款）`);
            }

            if (createdBills.length > 0) {
                await lineService.pushText(userId, [
                    "💳 信用卡帳單已產生",
                    "━━━━━━━━━━━━",
                    ...createdBills,
                ].join("\n"));
            }

            results.push({ userId, billsCreated: createdBills.length });
        }

        return NextResponse.json({ status: "ok", results });
    } catch (error) {
        console.error("[cron-credit-card-billing] Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
