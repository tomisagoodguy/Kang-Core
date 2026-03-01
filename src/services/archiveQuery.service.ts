import { db } from "@/lib/firebase/admin";
import { safeExecute } from "@/lib/gemini/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Archive RAG 問答
 * 取最近 50 筆 archive，組成 context 讓 Gemini 回答使用者問題
 */
export async function queryArchiveWithAI(question: string): Promise<string> {
    try {
        // 1. 取最近 50 筆 archive
        const snapshot = await db.collection("archive")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        if (snapshot.empty) {
            return "📦 目前還沒有任何收藏，先收藏一些文章或筆記再來問我吧！";
        }

        // 2. 組成 context 文字
        const context = snapshot.docs.map((doc, i) => {
            const d = doc.data();
            const title = (d.title as string) || "";
            const summary = (d.summary as string) || "";
            const keywords = (d.keywords as string[])?.join(", ") || "";
            const url = (d.url as string) || "";
            const date = (d.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString().slice(0, 10) || "";
            return `[${i + 1}] ${title || "（無標題）"}\n摘要: ${summary}\n關鍵字: ${keywords}${url ? `\n連結: ${url}` : ""}${date ? `\n日期: ${date}` : ""}`;
        }).join("\n\n");

        // 3. 送 Gemini 做 RAG 問答
        const prompt = `你是一個個人知識庫助理，以下是使用者的收藏紀錄：

${context}

請根據以上內容回答使用者的問題，若有相關的連結或文章請列出：
問題：${question}

回答要求：
- 簡潔聚焦，不超過 300 字
- 若有相關連結請附上
- 若完全沒有相關內容，請誠實告知
- 使用繁體中文`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await safeExecute(() => model.generateContent(prompt));
        return result.response.text();
    } catch (err) {
        console.error("[archiveQuery] error:", err);
        return "⚠️ 查詢失敗，請稍後再試";
    }
}
