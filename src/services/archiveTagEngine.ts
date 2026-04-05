import { db } from "@/lib/firebase/admin";

// ─── 記憶體快取（模組級，TTL 5 分鐘）────────────────────────────
interface CacheEntry {
    keywords: string[];
    expiresAt: number;
}
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

function getCachedKeywords(): string[] | null {
    if (_cache && Date.now() < _cache.expiresAt) return _cache.keywords;
    return null;
}

function setCachedKeywords(keywords: string[]): void {
    _cache = { keywords, expiresAt: Date.now() + CACHE_TTL_MS };
}

function invalidateCache(): void {
    _cache = null;
}

// ─── 輸入清理 ────────────────────────────────────────────────────
function sanitizeKeyword(text: string): string {
    return text
        .trim()
        .replace(/[<>'";&|]/g, "") // 移除潛在危險字元
        .slice(0, 20);             // 最多 20 字
}

export class ArchiveTagEngine {
    /**
     * 取得最常用的 N 個標籤（含記憶體快取）
     * 提供給 AI 作為分類參考
     */
    static async getTopKeywords(limit: number = 20): Promise<string[]> {
        // 1. 優先使用快取
        let keywords = getCachedKeywords();
        if (keywords) return keywords;

        // 2. 若無快取，從資料庫撈取依照使用次數排序的最高 N 個標籤
        try {
            const snapshot = await db.collection("archive_keywords")
                .orderBy("count", "desc")
                .limit(limit)
                .get();

            keywords = snapshot.docs.map(doc => doc.data().keyword as string);
            setCachedKeywords(keywords);
            return keywords;
        } catch (error) {
            console.error("[ArchiveTagEngine] Failed to fetch top keywords:", error);
            return [];
        }
    }

    /**
     * 學習新出現的關鍵字（含輸入清理）
     * 當歸檔 (Archive) 成功儲存時呼叫此方法
     */
    static async learn(keywords: string[]): Promise<void> {
        if (!keywords || keywords.length === 0) return;

        const sanitizedKeywords = keywords
            .map(sanitizeKeyword)
            .filter(k => k.length > 0);

        if (sanitizedKeywords.length === 0) return;

        const batch = db.batch();
        const collectionRef = db.collection("archive_keywords");

        let hasChanges = false;

        for (const keyword of sanitizedKeywords) {
            // 查詢是否已經有這個關鍵字
            const q = collectionRef.where("keyword", "==", keyword);
            const snapshot = await q.get();

            if (snapshot.empty) {
                const docRef = collectionRef.doc();
                batch.set(docRef, {
                    keyword,
                    count: 1,
                    lastUsed: new Date(),
                    createdAt: new Date()
                });
                hasChanges = true;
            } else {
                const docRef = snapshot.docs[0].ref;
                batch.update(docRef, {
                    count: (snapshot.docs[0].data().count || 0) + 1,
                    lastUsed: new Date()
                });
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await batch.commit();
            // 學習後使快取失效，確保下次取得最新常用清單
            invalidateCache();
        }
    }
}
