/**
 * 一次性腳本：取得 Google Drive OAuth2 Refresh Token
 * 執行：node scripts/get-drive-token.mjs
 */
import { createServer } from "http";
import { google } from "googleapis";
import { exec } from "child_process";
import fs from "fs";

const CLIENT_ID = "672000974194-vcdrlc5uvi3fq2mg1le58ihuhpbvas95.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/calendar"
    ],
    prompt: "consent", // 強制要求 refresh_token
});

console.log("\n🚀 正在開啟瀏覽器進行 Google 授權...\n");

// 開啟瀏覽器
exec(`start "" "${authUrl}"`);

// 啟動本地伺服器等待 callback
const server = createServer(async (req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get("code");

    if (!code) {
        res.writeHead(400);
        res.end("❌ 缺少授權碼");
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
            <html><body style="font-family:sans-serif;padding:40px;background:#0f0f0f;color:#fff">
            <h2>✅ 授權成功！</h2>
            <p>請回到編輯器查看 token.txt</p>
            </body></html>
        `);

        console.log("\n✅ 授權成功！寫入 token.txt\n");
        const out = `
GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}
GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}
GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}
`;
        fs.writeFileSync("token.txt", out);
        console.log("已成功儲存至 token.txt");

    } catch (err) {
        res.writeHead(500);
        res.end(`❌ 錯誤：${err.message}`);
        console.error("❌ 取得 token 失敗：", err.message);
    } finally {
        server.close();
        process.exit(0);
    }
});

server.listen(PORT, () => {
    console.log(`⏳ 等待 Google 授權回調（http://localhost:${PORT}）...`);
    console.log("   如果瀏覽器沒有自動開啟，請手動複製以下網址：");
    console.log(`\n   ${authUrl}\n`);
});
