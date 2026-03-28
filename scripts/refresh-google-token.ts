/**
 * 重新取得 Google OAuth Refresh Token
 * 執行：npx tsx scripts/refresh-google-token.ts
 */
import { google } from "googleapis";
import * as http from "http";
import * as url from "url";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REDIRECT_URI = "http://localhost:3002/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ 缺少 GOOGLE_OAUTH_CLIENT_ID 或 GOOGLE_OAUTH_CLIENT_SECRET");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // 強制重新同意，確保返回新的 refresh_token
    scope: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
    ],
});

console.log("\n✅ 請在瀏覽器開啟以下網址授權：\n");
console.log(authUrl);
console.log("\n⏳ 等待授權回調（localhost:3002）...\n");

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url || "", true);
    if (parsed.pathname !== "/callback") return;

    const code = parsed.query.code as string;
    if (!code) {
        res.end("❌ 授權失敗，未收到 code");
        server.close();
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        res.end("<h2>✅ 授權成功！請回到終端機查看 Token</h2>");
        server.close();

        console.log("\n🎉 授權成功！新的 Refresh Token：\n");
        console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log("\n請將此值更新至 .env.local 及 Vercel 環境變數。\n");
    } catch (e: any) {
        res.end("❌ Token 交換失敗");
        console.error("Token 交換失敗：", e.message);
        server.close();
    }
});

server.listen(3002);
