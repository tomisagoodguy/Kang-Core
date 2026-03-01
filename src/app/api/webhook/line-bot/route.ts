import { NextResponse } from "next/server";
import { WebhookEvent, Client, WebhookRequestBody, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { db } from "@/lib/firebase/admin";

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
                const replyToken = event.replyToken;

                // Skip LINE verification pings (dummy replyToken)
                if (replyToken === "00000000000000000000000000000000") {
                    return;
                }

                try {
                    // 1. Parse with AI
                    const parsedData = await parseUserInput(userText);

                    if (parsedData.isError) {
                        await client.replyMessage(replyToken, {
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

                        // 先回覆，再寫入 DB（避免 replyToken 過期）
                        let replyText = `✅ 記帳成功！\n💰 金額: $${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}`;
                        if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

                        await client.replyMessage(replyToken, { type: "text", text: replyText });
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

                        await client.replyMessage(replyToken, { type: "text", text: replyText });
                        // 統一使用 "archive"（舊版誤用 "archives"，已修正）
                        await db.collection("archive").add(entry);

                    } else {
                        await client.replyMessage(replyToken, {
                            type: "text",
                            text: "❓ 無法解析您的意圖，請試試：\n「吃飯花了 150」\n或「這個連結很有趣 https://...」",
                        });
                    }

                } catch (innerErr: any) {
                    console.error("LINE event processing error:", innerErr);
                    // Best-effort error reply
                    try {
                        await client.replyMessage(replyToken, {
                            type: "text",
                            text: `⚠️ 處理失敗，請稍後再試。\n${innerErr?.message?.slice(0, 100) ?? "未知錯誤"}`,
                        });
                    } catch {
                        // reply token 已過期，忽略
                    }
                }
            })
        );

        return NextResponse.json({ status: "success" });
    } catch (err: any) {
        console.error("LINE Webhook error:", err);
        return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
    }
}
