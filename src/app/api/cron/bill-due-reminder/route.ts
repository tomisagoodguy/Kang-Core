import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import type { CreditCardBill, RecurringExpense } from "@/models/schema";
import { lineService } from "@/services/line.service";
import { getAllLineUserIds } from "@/lib/userRegistry";

/** 提前幾天提醒（信用卡帳單到期日 / 定期支出下次觸發日皆適用） */
const REMINDER_DAYS_BEFORE = 3;

const daysBetween = (fromStr: string, toStr: string) =>
    Math.round((new Date(toStr).getTime() - new Date(fromStr).getTime()) / 86400000);

/** 計算 monthly/yearly 定期支出的下一次觸發日期（規則同 cron/recurring）。daily/weekly/weekday/holiday 太頻繁，不適合提前提醒 */
function computeNextTrigger(rule: Pick<RecurringExpense, "frequency" | "dayOfMonth" | "monthOfYear">, today: Date): string | null {
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    const d = today.getDate();
    const todayMidnight = new Date(y, m, d);

    if (rule.frequency === "monthly") {
        if (rule.dayOfMonth == null) return null;
        const daysInThisMonth = new Date(y, m + 1, 0).getDate();
        let candidate = new Date(y, m, Math.min(rule.dayOfMonth, daysInThisMonth));
        if (candidate < todayMidnight) {
            const daysInNextMonth = new Date(y, m + 2, 0).getDate();
            candidate = new Date(y, m + 1, Math.min(rule.dayOfMonth, daysInNextMonth));
        }
        return candidate.toISOString().slice(0, 10);
    }

    if (rule.frequency === "yearly") {
        if (rule.dayOfMonth == null || rule.monthOfYear == null) return null;
        const targetMonth = rule.monthOfYear - 1; // 0-indexed
        const daysInTargetMonthThisYear = new Date(y, targetMonth + 1, 0).getDate();
        let candidate = new Date(y, targetMonth, Math.min(rule.dayOfMonth, daysInTargetMonthThisYear));
        if (candidate < todayMidnight) {
            const daysInTargetMonthNextYear = new Date(y + 1, targetMonth + 1, 0).getDate();
            candidate = new Date(y + 1, targetMonth, Math.min(rule.dayOfMonth, daysInTargetMonthNextYear));
        }
        return candidate.toISOString().slice(0, 10);
    }

    return null;
}

/**
 * 帳單到期提醒：信用卡未繳/部分繳帳單、定期支出（monthly/yearly）即將自動入帳，提前 3 天提醒
 * Vercel Cron: 0 1 * * * (UTC) -> 台灣時間 09:00
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
        const results: Array<{ userId: string; remindersSent: number }> = [];

        for (const userId of userIds) {
            const reminders: string[] = [];

            // ── 信用卡帳單到期 ──
            // status 過濾在 JS 端做：加一個等值/in 條件就需要複合索引（本專案索引未部署）
            const billsSnap = await db.collection("credit_card_bills")
                .where("userId", "==", userId)
                .get();

            if (!billsSnap.empty) {
                const cardsSnap = await db.collection("credit_cards").where("userId", "==", userId).get();
                const cardNameMap = new Map(cardsSnap.docs.map(d => [d.id, (d.data().name as string)]));

                for (const doc of billsSnap.docs) {
                    const bill = doc.data() as CreditCardBill;
                    if (bill.status === "paid") continue;
                    if (bill.reminderSent) continue;
                    if (daysBetween(todayStr, bill.dueDate) !== REMINDER_DAYS_BEFORE) continue;

                    const owed = bill.totalAmount - bill.paidAmount;
                    const cardName = cardNameMap.get(bill.creditCardId) ?? "信用卡";
                    reminders.push(`💳 ${cardName}帳單 $${owed.toLocaleString()}，${bill.dueDate} 前繳款`);
                    await doc.ref.update({ reminderSent: true });
                }
            }

            // ── 定期支出即將自動入帳（僅 monthly / yearly） ──
            const recurringSnap = await db.collection("recurring_expenses")
                .where("userId", "==", userId)
                .where("isActive", "==", true)
                .get();

            for (const doc of recurringSnap.docs) {
                const rule = doc.data() as RecurringExpense;
                if (rule.tag === "Income") continue;
                if (rule.frequency !== "monthly" && rule.frequency !== "yearly") continue;

                const nextTriggerStr = computeNextTrigger(rule, now);
                if (!nextTriggerStr) continue;
                if (daysBetween(todayStr, nextTriggerStr) !== REMINDER_DAYS_BEFORE) continue;
                if (rule.lastReminderTriggerDate === nextTriggerStr) continue; // 已提醒過這次觸發

                reminders.push(`🔁 ${rule.description} $${rule.amount.toLocaleString()}，${nextTriggerStr} 將自動入帳`);
                await doc.ref.update({ lastReminderTriggerDate: nextTriggerStr });
            }

            if (reminders.length > 0) {
                await lineService.pushText(userId, [
                    "📅 帳單到期提醒",
                    "━━━━━━━━━━━━",
                    ...reminders,
                ].join("\n"));
            }

            results.push({ userId, remindersSent: reminders.length });
        }

        return NextResponse.json({ status: "ok", results });
    } catch (error) {
        console.error("[cron-bill-due-reminder] Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
