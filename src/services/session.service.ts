export interface SessionMessage {
    role: "user" | "assistant";
    text: string;
    timestamp: Date;
}

export interface SessionData {
    userId: string;
    messages: SessionMessage[];
    updatedAt: Date;
}

const MAX_HISTORY_LENGTH = 6;     // 保留最近 6 則訊息（3輪對話）
const SESSION_TTL_MINUTES = 15;   // 15 分鐘過期

class InMemorySessionService {
    private sessions = new Map<string, SessionData>();

    public clearExpiredSessions() {
        const now = new Date();
        const expiredKeys: string[] = [];
        for (const [userId, data] of this.sessions.entries()) {
            const diffMinutes = (now.getTime() - data.updatedAt.getTime()) / (1000 * 60);
            if (diffMinutes > SESSION_TTL_MINUTES) {
                expiredKeys.push(userId);
            }
        }
        for (const key of expiredKeys) {
            this.sessions.delete(key);
        }
    }

    public async getRecentHistory(userId: string): Promise<SessionMessage[]> {
        this.clearExpiredSessions();
        const data = this.sessions.get(userId);
        if (!data) return [];

        const now = new Date();
        const diffMinutes = (now.getTime() - data.updatedAt.getTime()) / (1000 * 60);
        if (diffMinutes > SESSION_TTL_MINUTES) {
            this.sessions.delete(userId);
            return [];
        }

        return data.messages;
    }

    public async addMessage(userId: string, role: "user" | "assistant", text: string): Promise<void> {
        this.clearExpiredSessions();
        let data = this.sessions.get(userId);
        if (!data) {
            data = { userId, messages: [], updatedAt: new Date() };
            this.sessions.set(userId, data);
        }

        data.messages.push({
            role,
            text: text.slice(0, 500),
            timestamp: new Date()
        });

        if (data.messages.length > MAX_HISTORY_LENGTH) {
            data.messages = data.messages.slice(-MAX_HISTORY_LENGTH);
        }
        data.updatedAt = new Date();
    }

    public async clearSession(userId: string): Promise<void> {
        this.sessions.delete(userId);
    }
}

// Preserve across hot reloads in Next.js development (important for dev mode)
const globalForSessionService = global as unknown as { SessionService: InMemorySessionService };
export const SessionService = globalForSessionService.SessionService || new InMemorySessionService();
if (process.env.NODE_ENV !== "production") {
    globalForSessionService.SessionService = SessionService;
}
