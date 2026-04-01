import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 載入環境變數
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const LINE_API_BASE = "https://api.line.me/v2/bot";

async function lineRequest(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    body?: Record<string, unknown>,
    isMultipart = false
): Promise<unknown> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN in env");

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    };
    if (!isMultipart) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${LINE_API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LINE API error ${res.status}: ${text}`);
    }

    return res.json();
}

/** Rich Menu 結構定義（6 格，底部橫排 2 行） */
const RICH_MENU_BODY = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "Kang-Core 快捷選單",
    chatBarText: "📋 快速功能",
    areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 421 }, action: { type: "message", text: "/記 ", label: "快速記帳" } },
        { bounds: { x: 833, y: 0, width: 834, height: 421 }, action: { type: "message", text: "/查 本月", label: "查本月" } },
        { bounds: { x: 1667, y: 0, width: 833, height: 421 }, action: { type: "message", text: "/待 ", label: "新增待辦" } },
        { bounds: { x: 0, y: 421, width: 833, height: 422 }, action: { type: "message", text: "/洞察", label: "AI 洞察" } },
        { bounds: { x: 833, y: 421, width: 834, height: 422 }, action: { type: "message", text: "/問 ", label: "知識庫查詢" } },
        { bounds: { x: 1667, y: 421, width: 833, height: 422 }, action: { type: "message", text: "/help", label: "說明" } },
    ],
};

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; background: #0f172a; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
            width: 2500px;
            height: 843px;
            gap: 2px;
            background: #cbd5e1;
        }
        .btn {
            background: #1e293b;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #f8fafc;
            text-decoration: none;
        }
        .btn:hover { background: #334155; }
        .icon { font-size: 100px; margin-bottom: 20px; }
        .label { font-size: 60px; font-weight: bold; letter-spacing: 2px; }
        .highlight { background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); }
    </style>
</head>
<body>
    <div class="grid">
        <div class="btn highlight"><div class="icon">💰</div><div class="label">快速記帳</div></div>
        <div class="btn"><div class="icon">📊</div><div class="label">查本月</div></div>
        <div class="btn"><div class="icon">📌</div><div class="label">新增待辦</div></div>
        <div class="btn"><div class="icon">🧠</div><div class="label">AI 洞察</div></div>
        <div class="btn highlight"><div class="icon">💬</div><div class="label">知識庫查詢</div></div>
        <div class="btn"><div class="icon">❓</div><div class="label">說明</div></div>
    </div>
</body>
</html>
`;

async function main() {
    console.log("[1/4] 正在產生選單圖片 (2500x843)...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 2500, height: 843, deviceScaleFactor: 1 });
    await page.setContent(HTML_CONTENT);
    const imageBuffer = await page.screenshot({ type: 'png' });
    await browser.close();
    console.log("-> 圖片產生完成");

    console.log("[2/4] 正在刪除舊的 Rich Menu...");
    const existing = await lineRequest("GET", "/richmenu/list") as { richmenus: { richMenuId: string }[] };
    for (const menu of existing.richmenus || []) {
        await lineRequest("DELETE", `/richmenu/${menu.richMenuId}`).catch(() => { });
    }

    console.log("[3/4] 建立並上傳新的 Rich Menu...");
    const created = await lineRequest("POST", "/richmenu", RICH_MENU_BODY as unknown as Record<string, unknown>) as { richMenuId: string };
    const richMenuId = created.richMenuId;

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "image/png",
        },
        body: Buffer.from(imageBuffer),
    });
    if (!uploadRes.ok) throw new Error(`圖片上傳失敗: ${await uploadRes.text()}`);

    console.log("[4/4] 設為預設...");
    await lineRequest("POST", `/user/all/richmenu/${richMenuId}`);

    console.log("✅ 成功！您的 LINE Bot 已經有自動選單了！");
}

main().catch((err: Error) => {
    console.error("❌ 錯誤:", err.message);
    process.exit(1);
});
