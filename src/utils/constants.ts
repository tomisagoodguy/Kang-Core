/**
 * 全域常數定義
 * 所有標籤名稱統一從此處 import，禁止在各頁面重複定義
 */

export const ALL_TAGS = [
    "Food",
    "Transport",
    "Entertainment",
    "Utilities",
    "Shopping",
    "Health",
    "Education",
    "Insurance",
    "Subscription",
    "Investment",
    "Travel",
    "Income",
    "Other",
] as const;

export type TagName = (typeof ALL_TAGS)[number];

/** 與 ALL_TAGS 相同，語義別名供 settings/tags 頁面使用 */
export const PARENT_TAGS = ALL_TAGS;
