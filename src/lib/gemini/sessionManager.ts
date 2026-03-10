import { ChatSession, GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL_NAME = "gemini-2.5-flash"; // Or configured

interface SessionData {
    chat: ChatSession;
    lastActive: Date;
    storeName?: string;
}

class ChatSessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private sessionTimeoutMs: number = 60 * 60 * 1000; // 1 hr

    public getOrCreateSession(userId: string, storeName?: string, enableFileSearch: boolean = false): ChatSession {
        this.cleanupExpiredSessions();

        const now = new Date();
        const sessionKey = userId;

        if (this.sessions.has(sessionKey)) {
            const sessionData = this.sessions.get(sessionKey)!;
            sessionData.lastActive = now;
            console.log(`[SessionManager] Reusing session for user: ${userId}`);
            return sessionData.chat;
        }

        console.log(`[SessionManager] Creating new session for user: ${userId}`);

        const tools: any[] = [];
        if (enableFileSearch && storeName) {
            tools.push({
                fileSearch: {
                    fileSearchStoreNames: [storeName]
                }
            });
        }

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: "你是一個專業的文件分析助手與生活助理。\n當用戶詢問一般問題時，友善、專業地回答。\n若有上傳文件，請結合文件庫搜尋並提供準確的回答。\n請保持對話記憶，若用戶提到「剛才」、「之前」，需回顧對話歷史。\n請務必使用繁體中文。（若系統無法取得文件內容，請誠實告知。）",
            tools: tools.length > 0 ? tools : undefined
        });

        const chat = model.startChat({
            history: [],
            generationConfig: {
                temperature: 0.7,
            }
        });

        this.sessions.set(sessionKey, {
            chat,
            lastActive: now,
            storeName,
        });

        return chat;
    }

    public clearSession(userId: string): boolean {
        if (this.sessions.has(userId)) {
            this.sessions.delete(userId);
            console.log(`[SessionManager] Cleared session for user: ${userId}`);
            return true;
        }
        return false;
    }

    private cleanupExpiredSessions() {
        const now = new Date();
        const expiredUsers: string[] = [];

        for (const [userId, session] of this.sessions.entries()) {
            if (now.getTime() - session.lastActive.getTime() >= this.sessionTimeoutMs) {
                expiredUsers.push(userId);
            }
        }

        for (const userId of expiredUsers) {
            this.sessions.delete(userId);
            console.log(`[SessionManager] Cleaned up expired session for user: ${userId}`);
        }
    }
}

// Preserve across hot reloads in Next.js development
const globalForSessionManager = global as unknown as { chatSessionManager: ChatSessionManager };
export const chatSessionManager = globalForSessionManager.chatSessionManager || new ChatSessionManager();
if (process.env.NODE_ENV !== "production") {
    globalForSessionManager.chatSessionManager = chatSessionManager;
}
