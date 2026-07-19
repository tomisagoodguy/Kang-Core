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

/** Threads 貼文保留天數：webhook 拒收超過此天數的舊貼文，cleanup cron 刪除逾期貼文 */
export const THREADS_RETENTION_DAYS = 30;

/** 產生 threads 集合 publishedAt 欄位的比較基準字串（格式 "YYYY-MM-DD HH:mm:ss"，可直接字串比較） */
export function threadsRetentionCutoff(): string {
    const cutoff = new Date(Date.now() - THREADS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return cutoff.toISOString().slice(0, 19).replace("T", " ");
}
