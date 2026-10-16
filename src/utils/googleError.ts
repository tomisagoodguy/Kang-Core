/**
 * 把 Google API 錯誤轉成給使用者看的說明與修復指引。
 * Gmail / Calendar / Drive / Sheets 共用同一組 GOOGLE_OAUTH_REFRESH_TOKEN，授權失效時全部一起壞。
 */
export function describeGoogleError(error: unknown): { message: string; hint: string } {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("invalid_grant")) {
        return {
            message,
            hint: "Google 授權已失效（refresh token 過期或被撤銷）。請執行 npx tsx scripts/refresh-google-token.ts 重新授權，並更新 Vercel 的 GOOGLE_OAUTH_REFRESH_TOKEN 後重新部署。若 OAuth 同意畫面仍是「測試中」，token 會每 7 天失效，需改為「正式版」。",
        };
    }
    if (message.includes("insufficient") || message.includes("403")) {
        return {
            message,
            hint: "Google 授權缺少必要權限（scope），請重跑 npx tsx scripts/refresh-google-token.ts 重新授權。",
        };
    }
    return { message, hint: "" };
}
