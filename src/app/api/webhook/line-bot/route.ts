import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { WebhookEvent, Client, WebhookRequestBody, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { db } from "@/lib/firebase/admin";

const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

/**
 * 處理單一 LINE 事件。
 * 使用 pushMessage 取代 replyMessage（不受 replyToken 時效限制）。
 */
async function processEvent(event: WebhookEvent): Promise<void> {
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
        console.error(`[processEvent] userId=${userId}:`, err);
        try {
            await client.pushMessage(userId, {
                type: "text",
                text: `⚠️ 處理失敗：${err?.message?.slice(0, 100) ?? "未知錯誤"}`,
            });
        } catch {
            // reply token 過期或 push 失敗，放棄
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

    // 🔑 立刻回 200 OK 給 LINE，確保 LINE 不會因超時重試
    // waitUntil 告訴 Vercel：「就算 response 已送出，也請等這些 Promise 跑完」
    waitUntil(Promise.all(events.map(processEvent)));

    return NextResponse.json({ status: "ok" });
}
