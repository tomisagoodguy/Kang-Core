import { db } from "@/lib/firebase/admin";
import type { ClassificationRule } from "@/models/schema";

// ─── 記憶體快取（模組級，TTL 5 分鐘）────────────────────────────
interface CacheEntry {
    rules: ClassificationRule[];
    expiresAt: number;
}
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

function getCachedRules(): ClassificationRule[] | null {
    if (_cache && Date.now() < _cache.expiresAt) return _cache.rules;
    return null;
}

function setCachedRules(rules: ClassificationRule[]): void {
    _cache = { rules, expiresAt: Date.now() + CACHE_TTL_MS };
}

function invalidateCache(): void {
    _cache = null;
}

// ─── 輸入清理 ────────────────────────────────────────────────────
/**
 * 清理 keyword，移除特殊字元，長度限制 20 字
 * 防止惡意字串（XSS、注入）進入 Firestore 規則庫
 */
function sanitizeKeyword(text: string): string {
    return text
        .trim()
        .replace(/[<>'";&|]/g, "") // 移除潛在危險字元
        .slice(0, 20);             // 最多 20 字
}

export class ClassificationEngine {
    /**
     * 嘗試匹配已知的分類規則（含記憶體快取）
     * @param text 使用者輸入的文字
     */
    static async match(text: string): Promise<{ tag: string; subTag?: string } | null> {
        const trimmed = text.trim().toLowerCase();

        // 1. 優先使用快取，避免每條訊息都全量讀取 Firestore
        let rules = getCachedRules();
        if (!rules) {
            const snapshot = await db.collection("classification_rules").get();
            rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassificationRule));
            setCachedRules(rules);
        }

        // 2. 匹配規則（關鍵字包含），優先匹配較長的關鍵字，且 confidence >= 0.7
        const sortedRules = [...rules]
            .filter(r => (r.confidence ?? 0.8) >= 0.7)
            .sort((a, b) => b.keyword.length - a.keyword.length);

        for (const rule of sortedRules) {
            if (trimmed.includes(rule.keyword.toLowerCase())) {
                // 更新命中次數與時間（異步不等待）
                db.collection("classification_rules").doc(rule.id!).update({
                    hitCount: (rule.hitCount || 0) + 1,
                    lastUsed: new Date()
                }).catch(() => { /* 不影響主流程 */ });

                return { tag: rule.tag, subTag: rule.subTag ?? undefined };
            }
        }

        return null;
    }

    /**
     * 學習新規則（含輸入清理）
     * 當使用者手動修改 tag 或快速指令/Gemini 解析成功時調用
     */
    /**
     * @param isManual 是否為使用者手動修改 tag（true → confidence 提升至 0.95）
     */
    static async learn(text: string, tag: string, subTag?: string, isManual = false): Promise<void> {
        if (!text || text.length < 2) return;

        const keyword = sanitizeKeyword(text);
        if (!keyword) return; // 清理後為空則跳過

        const q = db.collection("classification_rules").where("keyword", "==", keyword);
        const snapshot = await q.get();

        if (snapshot.empty) {
            await db.collection("classification_rules").add({
                keyword,
                tag,
                subTag: subTag || null,
                confidence: isManual ? 0.95 : 0.8,
                hitCount: 1,
                source: isManual ? "manual" : "auto",
                lastUsed: new Date(),
                createdAt: new Date()
            });
        } else {
            const doc = snapshot.docs[0];
            const existing = doc.data();
            const newConfidence = isManual
                ? 0.95  // 使用者修正 → 直接拉高
                : Math.min(1, (existing.confidence ?? 0.8) + 0.02);  // 每次命中微增

            await doc.ref.update({
                tag,
                subTag: subTag || null,
                confidence: newConfidence,
                hitCount: (existing.hitCount || 0) + 1,
                source: isManual ? "manual" : existing.source || "auto",
                lastUsed: new Date()
            });
        }

        // 學習後使快取失效，確保下次 match() 取得最新規則
        invalidateCache();
    }
}
