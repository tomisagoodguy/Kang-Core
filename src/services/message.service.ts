import { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { analyzeImage } from "@/lib/gemini/vision";
import { addEventToGoogleCalendar } from "@/lib/calendar/client";
import { db } from "@/lib/firebase/admin";
import { lineService } from "./line.service";
import { driveService } from "./drive.service";
import { discordService } from "./discord.service";

export class MessageService {
    /** 處理文字訊息 */
    async handleTextMessage(userText: string, userId: string): Promise<void> {
        const parsedData = await parseUserInput(userText);

        if (parsedData.isError) {
            await lineService.pushText(userId, `⚠️ 解析失敗：\n${parsedData.errorMessage}`);
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

            await lineService.pushText(userId, replyText);
            await db.collection("accounting").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else if (parsedData.type === "archive" && parsedData.archiveData) {
            const entry = {
                ...parsedData.archiveData,
                originalText: userText,
                source: "line",
                createdAt: new Date(),
            };
            let replyText = `📦 收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}`;
            if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

            await lineService.pushText(userId, replyText);
            await db.collection("archive").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else if (parsedData.type === "calendar" && parsedData.calendarData) {
            const entry = {
                ...parsedData.calendarData,
                originalText: userText,
                source: "line",
                createdAt: new Date(),
                status: "pending",
            };
            let replyText = `🗓️ 行事曆排定！\n📌 標題: ${entry.title}`;
            if (entry.actionDate) replyText += `\n📅 日期: ${entry.actionDate}`;
            if (entry.actionTime) replyText += `\n⏰ 時間: ${entry.actionTime}`;
            if (entry.description) replyText += `\n📝 備註: ${entry.description}`;

            // Add to Google Calendar
            try {
                const gcalEventId = await addEventToGoogleCalendar(entry);
                if (gcalEventId) {
                    (entry as Record<string, unknown>).gcalEventId = gcalEventId;
                    replyText += `\n✅ 已自動寫入 Google Calendar`;
                }
            } catch (err: unknown) {
                console.error("行事曆寫入失敗", err);
                replyText += `\n⚠️ Google Calendar 整合失敗`;
            }

            if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

            await lineService.pushText(userId, replyText);
            await db.collection("calendar").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else {
            await lineService.pushText(userId, "❓ 無法解析您的意圖，請試試：\n「吃飯花了 150」\n「明天下午三點開會」\n或「這個連結很有趣 https://...」");
        }
    }

    /** 處理圖片訊息（上傳 Drive + Gemini Vision 分析） */
    async handleImageMessage(messageId: string, userId: string): Promise<void> {
        // 先回覆「處理中」讓使用者知道收到了
        await lineService.pushText(userId, "🖼️ 收到圖片，分析中...");

        // 下載 LINE 圖片
        const imageBuffer = await lineService.getMessageContentBuffer(messageId);

        // 並行：上傳 Drive + Gemini Vision 分析
        const [driveUrl, parsedData] = await Promise.all([
            driveService.uploadToDrive(
                `${Date.now()}.jpg`,
                "image/jpeg",
                imageBuffer
            ),
            analyzeImage(imageBuffer, "image/jpeg"),
        ]);

        if (parsedData.isError) {
            await lineService.pushText(userId, `⚠️ 圖片分析失敗：${parsedData.errorMessage}\n📁 圖片已存到 Drive：${driveUrl}`);
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

            await lineService.pushText(userId, replyText);
            await db.collection("accounting").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else if (parsedData.type === "archive" && parsedData.archiveData) {
            const entry = {
                ...parsedData.archiveData,
                imageUrl: driveUrl,
                source: "line-image",
                createdAt: new Date(),
            };
            const replyText = `📦 圖片收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}\n📁 圖片: 已存 Drive`;

            await lineService.pushText(userId, replyText);
            await db.collection("archive").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else {
            await lineService.pushText(userId, `❓ 無法辨識圖片內容\n📁 圖片已存 Drive：${driveUrl}`);
        }
    }

    /** 處理檔案訊息（如 PDF、DOCX，上傳 Drive 並記錄到知識庫） */
    async handleFileMessage(messageId: string, fileName: string, userId: string): Promise<void> {
        await lineService.pushText(userId, "📁 收到檔案，上傳至雲端硬碟中...");

        try {
            const fileBuffer = await lineService.getMessageContentBuffer(messageId);

            // 上傳到 Drive，自動判斷 MIME type -> (使用預設或省略)
            const driveUrl = await driveService.uploadToDrive(fileName, "application/octet-stream", fileBuffer);

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
            await lineService.pushText(userId, replyText);
            await discordService.sendDiscordNotification(replyText);

        } catch (e: unknown) {
            console.error("handleFileMessage error:", e);
            await lineService.pushText(userId, "⚠️ 檔案處理失敗，請稍後再試。");
        }
    }

    /** 主要事件處理 */
    async processEvent(event: WebhookEvent): Promise<void> {
        if (event.type !== "message") return;

        const userId = event.source.userId;
        if (!userId) return;

        // Skip LINE verification pings
        if (event.replyToken === "00000000000000000000000000000000") return;

        // 加入防重複處理鎖 (LINE 有時會因為超時重傳相同的 Webhook 事件)
        try {
            await db.collection("processed_messages").doc(event.message.id).create({ timestamp: new Date() });
        } catch (e: unknown) {
            const error = e as { code?: number; message?: string };
            // 如果錯誤碼是 6 (ALREADY_EXISTS)，代表這個事件已經處理過了
            if (error.code === 6 || error.message?.includes("ALREADY_EXISTS")) {
                console.log(`[Event ${event.message.id}] Already processed. Skipping.`);
                return;
            }
        }

        try {
            if (event.message.type === "text") {
                const textMessage = event.message as TextMessage;
                await this.handleTextMessage(textMessage.text, userId);

            } else if (event.message.type === "image") {
                await this.handleImageMessage(event.message.id, userId);

            } else if (event.message.type === "file") {
                const fileMessage = event.message as unknown as { fileName: string };
                await this.handleFileMessage(event.message.id, fileMessage.fileName, userId);
            }
            // 其他訊息類型（影片、語音等）目前忽略

        } catch (err: unknown) {
            const error = err as Error;
            console.error(`[processEvent] userId=${userId}:`, error);
            try {
                await lineService.pushText(userId, `⚠️ 處理失敗：${error?.message?.slice(0, 100) ?? "未知錯誤"}`);
            } catch {
                // push message 失敗則靜默
            }
        }
    }
}

export const messageService = new MessageService();
