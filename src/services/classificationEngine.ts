import { db } from "@/lib/firebase/admin";

interface ClassificationRule {
    keyword: string;
    tag: string;
    subTag?: string;
    count: number;
    lastUsed: Date;
}

export class ClassificationEngine {
    /**
     * 嘗試匹配已知的分類規則
     * @param text 使用者輸入的文字
     */
    static async match(text: string): Promise<{ tag: string; subTag?: string } | null> {
        const trimmed = text.trim().toLowerCase();

        // 1. 取得所有規則（規模大時需優化，目前預期規則不多）
        const snapshot = await db.collection("classification_rules").get();
        const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassificationRule & { id: string }));

        // 2. 匹配規則（關鍵字包含）
        // 優先匹配較長的關鍵字
        const sortedRules = rules.sort((a, b) => b.keyword.length - a.keyword.length);

        for (const rule of sortedRules) {
            if (trimmed.includes(rule.keyword.toLowerCase())) {
                // 更新使用次數與時間（異步不等待）
                db.collection("classification_rules").doc(rule.id).update({
                    count: (rule.count || 0) + 1,
                    lastUsed: new Date()
                });

                return { tag: rule.tag, subTag: rule.subTag };
            }
        }

        return null;
    }

    /**
     * 學習新規則
     * 當使用者手動修改 tag 或 Gemini 解析成功時調用
     */
    static async learn(text: string, tag: string, subTag?: string) {
        if (!text || text.length < 2) return;

        // 簡單提取關鍵字（待優化，目前取前 10 個字或整段）
        const keyword = text.slice(0, 15).trim();

        const q = db.collection("classification_rules").where("keyword", "==", keyword);
        const snapshot = await q.get();

        if (snapshot.empty) {
            await db.collection("classification_rules").add({
                keyword,
                tag,
                subTag: subTag || null,
                count: 1,
                lastUsed: new Date(),
                createdAt: new Date()
            });
        } else {
            // 已存在則更新，如果 tag 不同，則不更新（保留舊的或以最後一次為準？）
            // 這裡採取「以最後一次成功分類為準」
            const doc = snapshot.docs[0];
            await doc.ref.update({
                tag,
                subTag: subTag || null,
                count: (doc.data().count || 0) + 1,
                lastUsed: new Date()
            });
        }
    }
}
