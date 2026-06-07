/**
 * 統一的標籤 emoji 與標籤名稱工具函數
 * 取代各模組中重複定義的 tagEmoji Record / function
 */

const TAG_EMOJI_MAP: Record<string, string> = {
    Food: "🍽",
    Transport: "🚗",
    Entertainment: "🎬",
    Utilities: "💡",
    Shopping: "🛒",
    Health: "🏥",
    Education: "📚",
    Insurance: "🛡️",
    Subscription: "🔖",
    Investment: "📈",
    Travel: "✈️",
    Other: "📦",
};

/**
 * 根據 tag 名稱回傳對應 emoji
 * @param tag - 標籤名稱（Food, Transport...）
 */
export function getTagEmoji(tag: string): string {
    return TAG_EMOJI_MAP[tag] ?? "📦";
}

/**
 * 回傳 "emoji + tag" 的格式化字串，方便 LINE 訊息使用
 * @param tag - 標籤名稱
 */
export function getTagLabel(tag: string): string {
    return `${getTagEmoji(tag)} ${tag}`;
}
