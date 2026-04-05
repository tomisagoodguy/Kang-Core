import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * 延遲函數 (ms)
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 萬用重試包裝器 (Exponential Backoff)
 * 專門處理 429, 500, 503 等可恢復錯誤
 */
export async function safeExecute<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    initialDelay: number = 2000
): Promise<T> {
    let currentDelay = initialDelay;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error: unknown) {
            const err = error as Record<string, unknown>;
            const status = typeof err?.status === 'number' ? err.status : 429;
            const message = typeof err?.message === 'string' ? err.message : "";
            const isRetryable = status === 429 || status === 500 || status === 503 || message.includes("429");

            if (isRetryable && i < maxRetries) {
                console.warn(`[AI Retry] 觸發限制 (${status || "429"}), 正在進行第 ${i + 1} 次重試... 延遲 ${currentDelay}ms`);
                await wait(currentDelay);
                currentDelay *= 2;
                continue;
            }
            throw error; // 不可恢復或已達上限，拋出錯誤讓外部處理（如切換模型）
        }
    }
    throw new Error("Retry limit reached");
}

/**
 * 獲取原始模型實例（僅在特殊需求時使用）
 */
export function getGeminiModel(modelName: string = "gemini-2.5-flash"): GenerativeModel {
    return genAI.getGenerativeModel({ model: modelName });
}
