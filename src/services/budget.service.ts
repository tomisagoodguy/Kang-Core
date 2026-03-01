import { db } from "@/lib/firebase/admin";
import { lineService } from "./line.service";

/**
 * 每次記帳後呼叫，檢查是否超過月預算門檻
 * 超過 80% 時提醒一次；到 100% 時再提醒一次
 */
export async function checkBudgetAlert(
    userId: string,
    amount: number,
    date: string, // YYYY-MM-DD
    tag?: string
): Promise<void> {
    try {
        const ym = date.slice(0, 7); // YYYY-MM
        const monthStart = `${ym}-01`;
        const monthEnd = `${ym}-31`;

        // 查詢預算設定（總預算或同 tag 的預算）
        const budgetSnap = await db.collection("budgets")
            .where("userId", "==", userId)
            .get();

        if (budgetSnap.empty) return; // 未設定預算則略過

        for (const budgetDoc of budgetSnap.docs) {
            const budget = budgetDoc.data();
            const { monthlyLimit, tag: budgetTag } = budget as { monthlyLimit: number; tag?: string };

            // 只處理符合的 tag 預算（無 tag 代表總預算）
            if (budgetTag && budgetTag !== tag) continue;

            // 查詢當月同 tag 總支出
            let query = db.collection("accounting")
                .where("date", ">=", monthStart)
                .where("date", "<=", monthEnd) as FirebaseFirestore.Query;

            const accSnap = await query.get();
            let entries = accSnap.docs.map(d => d.data());
            if (budgetTag) {
                entries = entries.filter(e => e.tag === budgetTag);
            }
            const monthTotal = entries.reduce((s, e) => s + ((e.amount as number) || 0), 0);

            const ratio = monthTotal / monthlyLimit;
            const tagLabel = budgetTag ? `「${budgetTag}」` : "總";

            // 判斷是否需要提醒（80% 或 100%）
            const thresholds = [
                { ratio: 1.0, key: `${budgetDoc.id}-${ym}-100`, msg: `🚨 警報！${ym} 月${tagLabel}預算已超支！\n📊 已花 $${monthTotal.toLocaleString()} / 預算 $${monthlyLimit.toLocaleString()}\n💡 超支 $${(monthTotal - monthlyLimit).toLocaleString()}，請注意！` },
                { ratio: 0.8, key: `${budgetDoc.id}-${ym}-80`, msg: `⚠️ 注意！${ym} 月${tagLabel}預算已用 ${Math.round(ratio * 100)}%\n📊 已花 $${monthTotal.toLocaleString()} / 預算 $${monthlyLimit.toLocaleString()}\n💡 剩餘 $${(monthlyLimit - monthTotal).toLocaleString()}，請節制消費` },
            ];

            for (const { ratio: threshold, key, msg } of thresholds) {
                if (ratio < threshold) continue;

                // 檢查本月是否已發送過此門檻的提醒
                const alertDoc = await db.collection("budget_alerts").doc(key).get();
                if (alertDoc.exists) continue;

                // 發送提醒 + 記錄已發送
                await lineService.pushText(userId, msg);
                await db.collection("budget_alerts").doc(key).set({ sentAt: new Date(), userId });
                break; // 同次只發最高等級的提醒
            }
        }
    } catch (err) {
        console.error("[BudgetService] checkBudgetAlert error:", err);
        // 不拋出，預算提醒失敗不應影響記帳主流程
    }
}
