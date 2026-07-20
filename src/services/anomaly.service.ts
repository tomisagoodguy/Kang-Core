import { db } from "@/lib/firebase/admin";
import { lineService } from "./line.service";
import { myExpenseTWD } from "@/utils/currency";
import { getTagEmoji } from "@/utils/tagEmoji";
import type { AccountingEntry } from "@/models/schema";

/** 固定必要開銷（房租、家裡伙食費分攤等）金額雖大但非「手癢」消費，排除偵測。與 accounting/page.tsx 的判斷邏輯保持一致 */
function isFixedNecessaryExpense(e: { source?: string; subTag?: string; description?: string }): boolean {
    if (e.source === "system") return true; // 定期支出／貸款 cron 自動插入
    const text = `${e.subTag ?? ""} ${e.description ?? ""}`;
    return /房租|家裡伙食費|伙食費分攤|幫家裡|家裡分攤|管理費/.test(text);
}

/**
 * 每次記帳後呼叫，用 IQR 方法（Q3 + 1.5×IQR）偵測本筆是否為近期異常大額支出。
 * 判斷邏輯與 Dashboard `accounting/page.tsx` 的視覺化警示一致，差別是這裡會主動推播 LINE。
 */
export async function checkAnomalyAlert(userId: string, entry: AccountingEntry): Promise<void> {
    try {
        if (entry.tag === "Income") return;
        if (isFixedNecessaryExpense(entry)) return;

        const amount = myExpenseTWD(entry);
        if (amount <= 0) return;

        const floor = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
        const snap = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", floor)
            .get();

        const history = snap.docs
            .map(d => d.data() as AccountingEntry)
            .filter(e => e.tag !== "Income" && !isFixedNecessaryExpense(e))
            .map(e => myExpenseTWD(e))
            .filter(a => a > 0)
            .sort((a, b) => a - b);

        if (history.length < 8) return; // 樣本太少，避免誤判

        const q1 = history[Math.floor(history.length * 0.25)];
        const q3 = history[Math.floor(history.length * 0.75)];
        const iqr = q3 - q1;
        const threshold = q3 + 1.5 * iqr;

        if (amount <= threshold) return;

        const tagAmounts = snap.docs
            .map(d => d.data() as AccountingEntry)
            .filter(e => e.tag === entry.tag && !isFixedNecessaryExpense(e))
            .map(e => myExpenseTWD(e))
            .filter(a => a > 0);
        const tagAvg = tagAmounts.length ? tagAmounts.reduce((s, v) => s + v, 0) / tagAmounts.length : 0;
        const timesNote = tagAvg > 0 ? `（比 ${entry.tag} 類均值高 ${(amount / tagAvg).toFixed(1)}x）` : "";

        await lineService.pushText(userId, [
            "⚡ 異常大額支出提醒",
            `${getTagEmoji(entry.tag)} ${entry.tag}｜$${amount.toLocaleString()}`,
            `${entry.description || entry.originalText || "（無描述）"}${timesNote}`,
            "遠高於你近期的日常水準，是手癢還是必要開銷？",
        ].join("\n"));
    } catch (err) {
        console.error("[AnomalyService] checkAnomalyAlert error:", err);
        // 不拋出，異常提醒失敗不應影響記帳主流程
    }
}
