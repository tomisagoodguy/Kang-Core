/** 主題追蹤預設關鍵字（Dashboard 主題支出卡與每日摘要共用） */
export const DEFAULT_TRACKED_KEYWORD = "約會";

interface KeywordMatchable {
    description?: string | null;
    subTag?: string | null;
    originalText?: string | null;
}

/**
 * 記帳是否含關鍵字：比對 description / subTag / originalText。
 * LINE 記帳的 originalText 保留使用者原句，即使 Gemini 改寫描述仍能命中；
 * 一則訊息記多筆時共用同一 originalText，會一起命中。
 */
export function matchesKeyword(entry: KeywordMatchable, keyword: string): boolean {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return false;
    const haystack = `${entry.description ?? ""} ${entry.subTag ?? ""} ${entry.originalText ?? ""}`.toLowerCase();
    return haystack.includes(needle);
}

const FREQUENT_TERM_MIN_ENTRIES = 3;
const FREQUENT_TERM_MAX_LEN = 4;

/**
 * 從記帳描述 / 子分類抓常出現的詞，當主題追蹤的候選關鍵字。
 * 中文沒有分詞，改取 2～4 字的連續片段，以「出現在幾筆記帳」計數（同筆重複只算一次）；
 * 短片段若被次數相近的長片段涵蓋（「當勞」⊂「麥當勞」），只留長的，避免選單出現半個詞。
 */
export function extractFrequentTerms(entries: KeywordMatchable[], limit = 15): string[] {
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const text = `${entry.description ?? ""} ${entry.subTag ?? ""}`;
        const terms = new Set<string>();
        for (const seg of text.match(/[一-鿿]+|[a-zA-Z]{2,}/g) ?? []) {
            if (/^[a-zA-Z]/.test(seg)) {
                terms.add(seg.toLowerCase());
                continue;
            }
            for (let n = 2; n <= Math.min(FREQUENT_TERM_MAX_LEN, seg.length); n++) {
                for (let i = 0; i + n <= seg.length; i++) terms.add(seg.slice(i, i + n));
            }
        }
        terms.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    }

    const candidates = [...counts].filter(([, c]) => c >= FREQUENT_TERM_MIN_ENTRIES);
    return candidates
        .filter(([term, count]) => !candidates.some(
            ([other, otherCount]) => other.length > term.length && other.includes(term) && otherCount >= count * 0.8,
        ))
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
        .slice(0, limit)
        .map(([term]) => term);
}
