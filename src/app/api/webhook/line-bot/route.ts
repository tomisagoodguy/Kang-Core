import { NextResponse } from "next/server";
import { WebhookEvent, Client, WebhookRequestBody, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { db } from "@/lib/firebase/admin";

// LINE Bot configuration - MUST be set in .env.local
const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

export async function POST(req: Request) {
    try {
        const body: WebhookRequestBody = await req.json();
        const events: WebhookEvent[] = body.events || [];

        await Promise.all(
            events.map(async (event) => {
                if (event.type !== "message" || event.message.type !== "text") {
                    return;
                }

                const textMessage = event.message as unknown as TextMessage;
                const userText = textMessage.text;
                const userId = event.source.userId; // useful later when scaling to multi-user / checking auth

                // 1. Pass input to AI Parser
                const parsedData = await parseUserInput(userText);

                if (parsedData.isError) {
                    // Send error message back
                    await client.replyMessage(event.replyToken, {
                        type: "text",
                        text: `⚠️ 解析失敗：\n${parsedData.errorMessage}`,
                    });
                    return;
                }

                // 2. Save to Firestore
                let replyMessageText = "";

                if (parsedData.type === "accounting" && parsedData.accountingData) {
                    const entry = {
                        ...parsedData.accountingData,
                        originalText: userText,
                        source: "line",
                        createdAt: new Date(),
                    };

                    const docRef = await db.collection("accounting").add(entry);
                    replyMessageText = `✅ 記帳成功！\n💰 金額: ${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}`;
                    if (parsedData.explanation) replyMessageText += `\n👾 AI 解釋: ${parsedData.explanation}`;

                } else if (parsedData.type === "archive" && parsedData.archiveData) {
                    const entry = {
                        ...parsedData.archiveData,
                        originalText: userText,
                        source: "line",
                        createdAt: new Date(),
                    };

                    const docRef = await db.collection("archives").add(entry);
                    replyMessageText = `📦 收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}`;
                    if (parsedData.explanation) replyMessageText += `\n👾 AI 解釋: ${parsedData.explanation}`;

                } else {
                    replyMessageText = "❓ 無法解析您的意圖，請換個方式再說一次！";
                }

                // 3. Inform user completion
                await client.replyMessage(event.replyToken, {
                    type: "text",
                    text: replyMessageText,
                });
            })
        );

        return NextResponse.json({ status: "success" });
    } catch (err: any) {
        console.error("LINE Webhook error:", err);
        return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
    }
}
