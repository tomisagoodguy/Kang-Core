import { NextResponse } from "next/server";
import { WebhookEvent, Client, WebhookRequestBody, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { db } from "@/lib/firebase/admin";

const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

/**
 * 處理單一 LINE 事件（非同步，不阻塞 webhook 回應）
 * 使用 pushMessage 取代 replyMessage，因為 replyToken 可能在 AI 處理期間超時。
 */
async function processEvent(event: WebhookEvent) {
    if (event.type !== "message" || event.message.type !== "text") return;

    const textMessage = event.message as unknown as TextMessage;
    const userText = textMessage.text;
    const userId = event.source.userId;

    if (!userId) return;

    // Skip LINE verification pings
    if (event.replyToken === "00000000000000000000000000000000") return;

    try {
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

            // 先回覆，再寫入 DB
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

    } catch (err: any) {
        console.error(`[processEvent] Error for userId=${userId}:`, err);
        try {
            await client.pushMessage(userId, {
                type: "text",
                text: `⚠️ 處理失敗，請稍後再試。\n${err?.message?.slice(0, 100) ?? "未知錯誤"}`,
            });
        } catch {
            // pushMessage 失敗則靜默
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

    // 🔑 關鍵：立刻回 200 OK 給 LINE，避免 LINE 以為失敗而自動重試
    // 所有事件處理都在背景非同步執行
    for (const event of events) {
        processEvent(event).catch((err) =>
            console.error("[webhook] Unhandled event error:", err)
        );
    }

    return NextResponse.json({ status: "ok" });
}
