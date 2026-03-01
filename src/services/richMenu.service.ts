/**
 * LINE Rich Menu Service
 * 建立底部 6 格快捷選單
 *
 * API: POST /api/admin/setup-richmenu 一次性手動觸發
 * 需要 CRON_SECRET 驗證（防止未授權觸發）
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";

/** 呼叫 LINE Messaging API */
async function lineRequest(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    isMultipart = false
): Promise<unknown> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    };
    if (!isMultipart) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${LINE_API_BASE}${path}`, {
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
        // 第一行：左、中、右
        {
            bounds: { x: 0, y: 0, width: 833, height: 421 },
            action: { type: "message", text: "/記 ", label: "💰 快速記帳" }
        },
        {
            bounds: { x: 833, y: 0, width: 834, height: 421 },
            action: { type: "message", text: "/查 本月", label: "📊 查本月" }
        },
        {
            bounds: { x: 1667, y: 0, width: 833, height: 421 },
            action: { type: "message", text: "/待 ", label: "📌 新增待辦" }
        },
        // 第二行：左、中、右
        {
            bounds: { x: 0, y: 421, width: 833, height: 422 },
            action: { type: "message", text: "/洞察", label: "🧠 AI 洞察" }
        },
        {
            bounds: { x: 833, y: 421, width: 834, height: 422 },
            action: { type: "message", text: "/問 ", label: "💬 知識庫查詢" }
        },
        {
            bounds: { x: 1667, y: 421, width: 833, height: 422 },
            action: { type: "message", text: "/help", label: "❓ 說明" }
        },
    ],
};

/**
 * 建立 Rich Menu 並設為預設
 * 1. 刪除現有 rich menus
 * 2. 建立新的 rich menu
 * 3. 上傳佔位圖片（使用 LINE 預設，或你可自行提供圖片 URL）
 * 4. 設為預設 rich menu
 */
export async function setupRichMenu(): Promise<{ richMenuId: string }> {
    // 1. 刪除所有現有 rich menus
    const existing = await lineRequest("GET", "/richmenu/list") as { richmenus: { richMenuId: string }[] };
    for (const menu of existing.richmenus || []) {
        await lineRequest("DELETE", `/richmenu/${menu.richMenuId}`).catch(() => { /* 忽略錯誤 */ });
    }

    // 2. 建立新的 rich menu
    const created = await lineRequest("POST", "/richmenu", RICH_MENU_BODY) as { richMenuId: string };
    const richMenuId = created.richMenuId;

    // 3. 上傳 rich menu 圖片（使用純色佔位圖）
    //    圖片需要 2500x843 px，JPEG 或 PNG
    //    此處假設你已上傳到 Drive 或 CDN，URL 設定在環境變數
    const imageUrl = process.env.RICH_MENU_IMAGE_URL;
    if (imageUrl) {
        // 下載圖片並上傳到 LINE
        const imgRes = await fetch(imageUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/png";

        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const uploadRes = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}/content`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": contentType,
            },
            body: imgBuffer,
        });

        if (!uploadRes.ok) {
            console.warn(`[RichMenu] 圖片上傳失敗: ${await uploadRes.text()}`);
        }
    } else {
        console.warn("[RichMenu] RICH_MENU_IMAGE_URL 未設定，Rich Menu 將無圖片");
    }

    // 4. 設為預設 rich menu
    await lineRequest("POST", `/user/all/richmenu/${richMenuId}`);

    console.log(`[RichMenu] 建立成功: ${richMenuId}`);
    return { richMenuId };
}
