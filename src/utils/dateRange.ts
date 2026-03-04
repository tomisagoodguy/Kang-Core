/**
 * 統一日期範圍解析
 * 合併自 quickCommand.ts/parsePeriod() 與 queryEngine.ts/resolvePeriod()
 * 同時支援中文（本月）與英文 key（this_month）
 */

export interface DateRange {
    from: string;
    to: string;
    label: string;
}

/** 中文別名 → 正規化 key */
const ALIASES: Record<string, string> = {
    "本月": "this_month",
    "這個月": "this_month",
    "上月": "last_month",
    "上個月": "last_month",
    "本週": "this_week",
    "這週": "this_week",
    "上週": "last_week",
    "今天": "today",
    "今日": "today",
    "明天": "tomorrow",
    "明日": "tomorrow",
};

/**
 * 解析時間區間描述（中文或英文 key）為日期範圍
 * @returns DateRange 或 null（無法辨識時）
 */
export function resolveDateRange(period: string): DateRange | null {
    const normalized = ALIASES[period] ?? period;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based

    switch (normalized) {
        case "this_month": {
            const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
            return { from, to: now.toISOString().slice(0, 10), label: "本月" };
        }
        case "last_month": {
            const pm = m === 0 ? 11 : m - 1;
            const py = m === 0 ? y - 1 : y;
            const from = `${py}-${String(pm + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(py, pm + 1, 0).getDate();
            const to = `${py}-${String(pm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            return { from, to, label: "上月" };
        }
        case "this_week": {
            const day = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            return { from: monday.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), label: "本週" };
        }
        case "last_week": {
            const day = now.getDay();
            const lastMonday = new Date(now);
            lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
            const lastSunday = new Date(lastMonday);
            lastSunday.setDate(lastMonday.getDate() + 6);
            return { from: lastMonday.toISOString().slice(0, 10), to: lastSunday.toISOString().slice(0, 10), label: "上週" };
        }
        case "today": {
            const today = now.toISOString().slice(0, 10);
            return { from: today, to: today, label: "今日" };
        }
        case "tomorrow": {
            const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            return { from: tmr, to: tmr, label: "明天" };
        }
        default:
            return null;
    }
}
