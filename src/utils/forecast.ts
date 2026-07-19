/**
 * 月底結餘預測共用邏輯（前端 Dashboard 與 daily-summary cron 共用同一套公式）。
 *
 * 預測 = 已花費（含定期）＋ 變動日均 × 剩餘天數 × 校準係數 ＋ 本月尚未觸發的定期支出
 * 變動日均排除定期入帳（source === "system"），避免固定支出灌高日均又在月底重複計算。
 * 校準係數（biasMultiplier）只套用在「變動支出」這個統計推估的部分——定期支出金額是已知的，不需要校準。
 */

import { myExpenseTWD } from "@/utils/currency";

export interface ForecastEntryLike {
    date?: string;
    tag?: string;
    source?: string;
    amount?: number;
    amountTWD?: number;
    exchangeRate?: number;
    settlement?: { myShare?: number } | null;
}

export interface ForecastRecurringRuleLike {
    amount: number;
    tag?: string;
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    dayOfMonth?: number;
    dayOfWeek?: number;
    monthOfYear?: number;
    isActive?: boolean;
}

export interface MonthlyForecastResult {
    monthYear: string;
    daysElapsed: number;
    daysInMonth: number;
    daysLeft: number;
    variableSoFar: number;
    variableDailyAvg: number;
    variableProjectionRemaining: number;
    upcomingRecurring: number;
    monthExpensesSoFar: number;
    monthIncomeSoFar: number;
    projectedExpense: number;
    projectedBalance: number;
    biasMultiplierUsed: number;
}

/**
 * @param entries 任意範圍的記帳資料，函式內部會自行過濾出屬於 monthYear 的部分
 * @param recurring 有效的定期支出規則
 * @param monthYear 目標月份 "YYYY-MM"
 * @param asOfDate 預測基準日 "YYYY-MM-DD"，必須落在 monthYear 內
 * @param biasMultiplier 套用在變動支出剩餘天數推估上的校準係數，預設 1（無校準）
 */
export function calculateMonthlyForecast(
    entries: ForecastEntryLike[],
    recurring: ForecastRecurringRuleLike[],
    monthYear: string,
    asOfDate: string,
    biasMultiplier = 1,
): MonthlyForecastResult | null {
    if (!asOfDate.startsWith(monthYear)) return null;

    const daysElapsed = Number(asOfDate.slice(8, 10));
    if (daysElapsed <= 0) return null;

    const [y, m] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysLeft = daysInMonth - daysElapsed;

    const monthEntries = entries.filter(e => e.date?.startsWith(monthYear));
    const monthExpenseEntries = monthEntries.filter(e => e.tag !== "Income");
    const monthExpensesSoFar = monthExpenseEntries.reduce((sum, e) => sum + myExpenseTWD(e), 0);
    const recurringSpent = monthExpenseEntries
        .filter(e => e.source === "system")
        .reduce((sum, e) => sum + myExpenseTWD(e), 0);
    const monthIncomeSoFar = monthEntries
        .filter(e => e.tag === "Income")
        .reduce((sum, e) => sum + myExpenseTWD(e), 0);

    const variableSoFar = Math.max(0, monthExpensesSoFar - recurringSpent);
    const variableDailyAvg = variableSoFar / daysElapsed;
    const variableProjectionRemaining = variableDailyAvg * daysLeft * biasMultiplier;

    // 本月剩餘天數內會觸發的定期支出（規則同 cron/recurring：超出當月天數的 dayOfMonth 在月底觸發）
    const upcomingRecurring = recurring
        .filter(r => r.isActive !== false && r.tag !== "Income")
        .reduce((sum, r) => {
            if (r.frequency === "daily") return sum + r.amount * daysLeft;
            if (r.frequency === "weekly" && r.dayOfWeek != null) {
                let count = 0;
                for (let d = daysElapsed + 1; d <= daysInMonth; d++) {
                    if (new Date(y, m - 1, d).getDay() === r.dayOfWeek) count++;
                }
                return sum + r.amount * count;
            }
            if (r.frequency === "monthly" && r.dayOfMonth != null) {
                const triggerDay = Math.min(r.dayOfMonth, daysInMonth);
                return triggerDay > daysElapsed ? sum + r.amount : sum;
            }
            if (r.frequency === "yearly" && r.monthOfYear === m && r.dayOfMonth != null) {
                const triggerDay = Math.min(r.dayOfMonth, daysInMonth);
                return triggerDay > daysElapsed ? sum + r.amount : sum;
            }
            return sum;
        }, 0);

    const projectedExpense = Math.round(monthExpensesSoFar + variableProjectionRemaining + upcomingRecurring);
    const projectedBalance = monthIncomeSoFar - projectedExpense;

    return {
        monthYear,
        daysElapsed,
        daysInMonth,
        daysLeft,
        variableSoFar,
        variableDailyAvg,
        variableProjectionRemaining,
        upcomingRecurring,
        monthExpensesSoFar,
        monthIncomeSoFar,
        projectedExpense,
        projectedBalance,
        biasMultiplierUsed: biasMultiplier,
    };
}

/** EMA 更新校準係數，並夾在合理範圍內避免單月異常值把預測帶偏 */
export function updateBiasMultiplier(oldBias: number, errorRatio: number, weight = 0.3): number {
    const clamped = Math.min(2, Math.max(0.3, errorRatio));
    const next = oldBias * (1 - weight) + clamped * weight;
    return Math.min(1.5, Math.max(0.5, next));
}
