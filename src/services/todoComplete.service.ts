import { db } from "@/lib/firebase/admin";

interface TodoCompleteResult {
    success: boolean;
    message: string;
}

/**
 * 透過關鍵字搜尋 pending 待辦並標記為 done
 * @param keyword 使用者輸入的關鍵字（部分比對）
 */
export async function completeTodo(keyword: string): Promise<TodoCompleteResult> {
    try {
        const trimmedKeyword = keyword.trim().toLowerCase();
        if (!trimmedKeyword) {
            return { success: false, message: "❓ 請輸入待辦關鍵字，例如：/完成 繳電費" };
        }

        // 查詢所有 pending 待辦
        const snapshot = await db.collection("calendar")
            .where("status", "==", "pending")
            .get();

        if (snapshot.empty) {
            return { success: false, message: "📋 目前沒有待辦事項" };
        }

        // 關鍵字比對（title 包含）
        const matched = snapshot.docs.filter(doc => {
            const title = ((doc.data().title as string) || "").toLowerCase();
            return title.includes(trimmedKeyword);
        });

        if (matched.length === 0) {
            return {
                success: false,
                message: `❓ 找不到包含「${keyword}」的待辦事項\n\n輸入 /查 行事曆 查看所有待辦`
            };
        }

        if (matched.length > 1) {
            const titles = matched.slice(0, 5).map((d, i) => `${i + 1}. ${d.data().title}`).join("\n");
            return {
                success: false,
                message: `❓ 找到 ${matched.length} 筆符合的待辦，請輸入更明確的關鍵字：\n${titles}`
            };
        }

        // 唯一比對：標記為完成
        const doc = matched[0];
        const title = doc.data().title as string;
        const completedAt = new Date();

        await doc.ref.update({
            status: "done",
            completedAt,
        });

        return {
            success: true,
            message: [
                "✅ 待辦已完成！",
                "━━━━━━━━━━━━",
                `📋 ${title}`,
                `🕐 完成時間: ${completedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
            ].join("\n"),
        };
    } catch (err) {
        console.error("[TodoComplete] error:", err);
        return { success: false, message: "⚠️ 操作失敗，請稍後再試" };
    }
}
