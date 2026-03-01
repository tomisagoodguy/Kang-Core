import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { WebhookEvent, Client, WebhookRequestBody, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { analyzeImage } from "@/lib/gemini/vision";
import { uploadFileToDrive } from "@/lib/drive/client";
import { db } from "@/lib/firebase/admin";

const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

/** 將 ReadableStream 轉換為 Buffer */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

/** 處理文字訊息 */
async function handleTextMessage(userText: string, userId: string, replyToken: string): Promise<void> {
    const parsedData = await parseUserInput(userText);

    if (parsedData.isError) {
        await client.pushMessage(userId, {
            type: "text",
            text: `⚠️ 解析失敗：\n${parsedData.errorMessage}`,
        });
        return;
    }

    if (parsedData.type === "accounting" && parsedData.accountingData) {
        const entry = {
            ...parsedData.accountingData,
            originalText: userText,
            source: "line",
            createdAt: new Date(),
        };
        let replyText = `✅ 記帳成功！\n💰 金額: $${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}`;
        if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

        await client.pushMessage(userId, { type: "text", text: replyText });
        await db.collection("accounting").add(entry);

    } else if (parsedData.type === "archive" && parsedData.archiveData) {
        const entry = {
            ...parsedData.archiveData,
            originalText: userText,
            source: "line",
            createdAt: new Date(),
        };
        let replyText = `📦 收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}`;
        if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

        await client.pushMessage(userId, { type: "text", text: replyText });
        await db.collection("archive").add(entry);

    } else {
        await client.pushMessage(userId, {
            type: "text",
            text: "❓ 無法解析您的意圖，請試試：\n「吃飯花了 150」\n或「這個連結很有趣 https://...」",
        });
    }
}

/** 處理圖片訊息（上傳 Drive + Gemini Vision 分析） */
async function handleImageMessage(messageId: string, userId: string): Promise<void> {
    // 先回覆「處理中」讓使用者知道收到了
    await client.pushMessage(userId, {
        type: "text",
        text: "🖼️ 收到圖片，分析中...",
    });

    // 下載 LINE 圖片
    const stream = await client.getMessageContent(messageId);
    const imageBuffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

    // 並行：上傳 Drive + Gemini Vision 分析
    const [driveUrl, parsedData] = await Promise.all([
        uploadFileToDrive(
            imageBuffer,
            `${Date.now()}.jpg`,
            "receipts", // 預設收據資料夾，Vision 結果出來後再確認
            "image/jpeg"
        ),
        analyzeImage(imageBuffer, "image/jpeg"),
    ]);

    if (parsedData.isError) {
        await client.pushMessage(userId, {
            type: "text",
            text: `⚠️ 圖片分析失敗：${parsedData.errorMessage}\n📁 圖片已存到 Drive：${driveUrl}`,
        });
        return;
    }

    if (parsedData.type === "accounting" && parsedData.accountingData) {
        const entry = {
            ...parsedData.accountingData,
            imageUrl: driveUrl,
            source: "line-image",
            createdAt: new Date(),
        };
        const replyText = `✅ 收據記帳成功！\n💰 金額: $${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}\n📁 圖片: 已存 Drive`;

        await client.pushMessage(userId, { type: "text", text: replyText });
        await db.collection("accounting").add(entry);

    } else if (parsedData.type === "archive" && parsedData.archiveData) {
        const entry = {
            ...parsedData.archiveData,
            imageUrl: driveUrl,
            source: "line-image",
            createdAt: new Date(),
        };
        const replyText = `📦 圖片收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}\n📁 圖片: 已存 Drive`;

        await client.pushMessage(userId, { type: "text", text: replyText });
        await db.collection("archive").add(entry);

    } else {
        await client.pushMessage(userId, {
            type: "text",
            text: `❓ 無法辨識圖片內容\n📁 圖片已存 Drive：${driveUrl}`,
        });
    }
}

/** 處理檔案訊息（如 PDF、DOCX，上傳 Drive 並記錄到知識庫） */
async function handleFileMessage(messageId: string, fileName: string, userId: string): Promise<void> {
    await client.pushMessage(userId, {
        type: "text",
        text: "📁 收到檔案，上傳至雲端硬碟中...",
    });

    try {
        const stream = await client.getMessageContent(messageId);
        const fileBuffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

        // 上傳到 Drive，自動判斷 MIME type
        const driveUrl = await uploadFileToDrive(fileBuffer, fileName, "archive");

        const entry = {
            title: fileName,
            summary: "此檔案由 LINE 機器人上傳，尚未提供詳細解析。",
            keywords: ["file", "document"],
            url: driveUrl,
            source: "line-file",
            createdAt: new Date(),
        };

        const replyText = `✅ 檔案儲存成功！\n📁 標題：${fileName}\n🔗 存檔位置：已存 Drive`;

        await db.collection("archive").add(entry);
        await client.pushMessage(userId, { type: "text", text: replyText });
    } catch (e: any) {
        console.error("handleFileMessage error:", e);
        await client.pushMessage(userId, { type: "text", text: "⚠️ 檔案處理失敗，請稍後再試。" });
    }
}

/** 主要事件處理 */
async function processEvent(event: WebhookEvent): Promise<void> {
    if (event.type !== "message") return;

    const userId = event.source.userId;
    if (!userId) return;

    // Skip LINE verification pings
    if (event.replyToken === "00000000000000000000000000000000") return;

    // 加入防重複處理鎖 (LINE 有時會因為超時重傳相同的 Webhook 事件)
    try {
        await db.collection("processed_messages").doc(event.message.id).create({ timestamp: new Date() });
    } catch (e: any) {
        // 如果錯誤碼是 6 (ALREADY_EXISTS)，代表這個事件已經處理過了
        if (e.code === 6 || e.message?.includes("ALREADY_EXISTS")) {
            console.log(`[Event ${event.message.id}] Already processed. Skipping.`);
            return;
        }
    }

    try {
        if (event.message.type === "text") {
            const textMessage = event.message as TextMessage;
            await handleTextMessage(textMessage.text, userId, event.replyToken);

        } else if (event.message.type === "image") {
            await handleImageMessage(event.message.id, userId);

        } else if (event.message.type === "file") {
            const fileMessage = event.message as any;
            await handleFileMessage(event.message.id, fileMessage.fileName, userId);
        }
        // 其他訊息類型（影片、語音等）目前忽略

    } catch (err: any) {
        console.error(`[processEvent] userId=${userId}:`, err);
        try {
            await client.pushMessage(userId, {
                type: "text",
                text: `⚠️ 處理失敗：${err?.message?.slice(0, 100) ?? "未知錯誤"}`,
            });
        } catch {
            // push message 失敗則靜默
        }
    }
}

export async function POST(req: Request) {
    let body: WebhookRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ status: "bad_request" }, { status: 400 });
    }

    const events: WebhookEvent[] = body.events || [];

    // 立刻回 200 OK，waitUntil 確保 Vercel 等事件處理完畢
    waitUntil(Promise.all(events.map(processEvent)));

    return NextResponse.json({ status: "ok" });
}
