import { db } from "@/lib/firebase/admin";

export interface SessionMessage {
    role: "user" | "assistant";
    text: string;
    timestamp: Date;
}

import { firestore } from "firebase-admin";

export interface SessionData {
    userId: string;
    messages: SessionMessage[];
    updatedAt: Date | firestore.Timestamp;
}

const MAX_HISTORY_LENGTH = 6;     // 保留最近 6 則訊息（3輪對話）
const SESSION_TTL_MINUTES = 15;   // 15 分鐘過期

export class SessionService {
    /**
     * 取得使用者的近期對話紀錄
     */
    static async getRecentHistory(userId: string): Promise<SessionMessage[]> {
        try {
            const docRef = db.collection("sessions").doc(userId);
            const doc = await docRef.get();

            if (!doc.exists) {
                return [];
            }

            const data = doc.data() as SessionData;

            // 檢查是否過期
            const now = new Date();
            const lastUpdated = "toDate" in data.updatedAt ? data.updatedAt.toDate() : new Date(data.updatedAt);
            const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

            if (diffMinutes > SESSION_TTL_MINUTES) {
                // 已過期，清除紀錄
                await this.clearSession(userId);
                return [];
            }

            return data.messages;
        } catch (error) {
            console.error("[SessionService] Failed to get session history:", error);
            return [];
        }
    }

    /**
     * 增加歷史訊息到對話紀錄中
     */
    static async addMessage(userId: string, role: "user" | "assistant", text: string): Promise<void> {
        try {
            const docRef = db.collection("sessions").doc(userId);

            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);

                let messages: SessionMessage[] = [];
                if (doc.exists) {
                    const data = doc.data() as SessionData;
                    messages = data.messages || [];
                }

                // 加入新訊息
                messages.push({
                    role,
                    text: text.slice(0, 500), // 限制每則訊息字數，避免撐爆 prompt
                    timestamp: new Date()
                });

                // 限制陣列長度
                if (messages.length > MAX_HISTORY_LENGTH) {
                    messages = messages.slice(-MAX_HISTORY_LENGTH);
                }

                // 寫回 DB
                transaction.set(docRef, {
                    userId,
                    messages,
                    updatedAt: new Date()
                }, { merge: true });
            });
        } catch (error) {
            console.error("[SessionService] Failed to add message to session:", error);
        }
    }

    /**
     * 清除通話紀錄
     */
    static async clearSession(userId: string): Promise<void> {
        try {
            await db.collection("sessions").doc(userId).delete();
        } catch (error) {
            console.error("[SessionService] Failed to clear session:", error);
        }
    }
}
