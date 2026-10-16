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
