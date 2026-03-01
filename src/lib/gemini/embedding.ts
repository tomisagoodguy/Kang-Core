import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * 取得一組文字的向量 (Embedding)
 * 使用 Gemini gemini-embedding-001 模型
 */
export async function getEmbedding(text: string): Promise<number[]> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("[Embedding] Error generating embedding:", error);
        throw error;
    }
}
