/**
 * 讀取所有已註冊的 LINE user IDs（供 Cron Jobs 迭代）
 * 環境變數 LINE_USER_IDS: 逗號分隔，例如 "Uxxx,Uyyy"
 * 若未設定則 fallback 到 LINE_USER_ID（維持向後相容）
 */
export function getAllLineUserIds(): string[] {
    const multi = process.env.LINE_USER_IDS || "";
    const single = process.env.LINE_USER_ID || "";
    const raw = multi || single;
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * 透過 Google 帳號 email 取得對應的 LINE userId（供 Dashboard API 用）
 * 環境變數 EMAIL_LINE_MAP: 逗號分隔 "email:lineUserId" pairs
 * 例如 "admin@gmail.com:Uxxx,mom@gmail.com:Uyyy"
 */
export function getLineUserIdFromEmail(email: string): string | null {
    const raw = process.env.EMAIL_LINE_MAP || "";
    if (!raw) return null;
    const pairs = raw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
        const colonIdx = pair.indexOf(":");
        if (colonIdx === -1) continue;
        const e = pair.slice(0, colonIdx).trim().toLowerCase();
        const id = pair.slice(colonIdx + 1).trim();
        if (e === email.toLowerCase()) return id;
    }
    return null;
}

/**
 * 透過 LINE userId 反查對應的 Google email（供 Email 報表寄送用）
 * 同樣讀取 EMAIL_LINE_MAP，找不到回 null（該用戶跳過寄信）
 */
export function getEmailFromLineUserId(userId: string): string | null {
    const raw = process.env.EMAIL_LINE_MAP || "";
    if (!raw) return null;
    const pairs = raw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
        const colonIdx = pair.indexOf(":");
        if (colonIdx === -1) continue;
        const e = pair.slice(0, colonIdx).trim();
        const id = pair.slice(colonIdx + 1).trim();
        if (id === userId) return e;
    }
    return null;
}
