import { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { parseUserInput } from "@/lib/gemini/parser";
import { analyzeImage } from "@/lib/gemini/vision";
import { addEventToGoogleCalendar } from "@/lib/calendar/client";
import { db } from "@/lib/firebase/admin";
import { lineService } from "./line.service";
import { driveService } from "./drive.service";
import { discordService } from "./discord.service";
import { parseQuickCommand } from "./quickCommand";
import { executeQuery } from "./queryEngine";
import { ClassificationEngine } from "./classificationEngine";
import { checkBudgetAlert } from "./budget.service";
import { ArchiveTagEngine } from "./archiveTagEngine";
import { SessionService } from "./session.service";
import { getEmbedding } from "@/lib/gemini/embedding";
import { chatSessionManager } from "@/lib/gemini/sessionManager";
import { FileManager } from "@/lib/gemini/fileManager";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { AccountingEntry, ArchiveEntry, CalendarEntry, RecurringExpense } from "@/models/schema";

export class MessageService {
    /** 內部發送訊息並紀錄到短記憶 */
    private async sendReply(userId: string, replyText: string): Promise<void> {
        await lineService.pushText(userId, replyText);
        SessionService.addMessage(userId, "assistant", replyText).catch(console.error);
    }

    /** 處理文字訊息 */
    async handleTextMessage(userText: string, userId: string): Promise<void> {
        // 先取得歷史對話
        const history = await SessionService.getRecentHistory(userId);
        const historyContext = history.length > 0
            ? history.map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.text}`).join('\n')
            : undefined;

        // 寫入 User 紀錄（背景執行不阻擋）
        SessionService.addMessage(userId, "user", userText).catch(console.error);
        // 快速指令攔截（/記, /查, /待, /help）— 不走 Gemini
        const quickResult = await parseQuickCommand(userText, userId);
        if (quickResult.handled) {
            await this.sendReply(userId, quickResult.replyText!);
            if (!userText.trim().startsWith("/help") && !userText.trim().startsWith("/查")) {
                await discordService.sendDiscordNotification(quickResult.replyText!);
            }
            return;
        }

        // 規則引擎初步攔截 (C9: 自動分類規則) — 不走 Gemini
        // 若句子包含多個數字，可能有多筆記帳或特定日期，跳過規則引擎讓 Gemini 精確解析
        const numMatches = userText.match(/\d+/g);
        if (!numMatches || numMatches.length <= 1) {
            const ruleMatch = await ClassificationEngine.match(userText);
            if (ruleMatch) {
                // 提取金額（正規表達式輔助）
                const amountMatch = userText.match(/(\d+)/);
                if (amountMatch) {
                    const amount = Number(amountMatch[1]);
                    const entry: AccountingEntry = {
                        amount,
                        tag: ruleMatch.tag as any,
                        subTag: ruleMatch.subTag ?? undefined,
                        date: new Date().toISOString().slice(0, 10),
                        description: userText,
                        originalText: userText,
                        source: "line-rule",
                        createdAt: new Date(),
                    };
                    const replyText = `✅ 規則自動匹配！\n💰 金額: $${amount}\n🏷️ 標籤: ${entry.tag}${entry.subTag ? ` (${entry.subTag})` : ""}\n📅 日期: ${entry.date}\n🤖 AI: 此商店已知，自動套用分類。`;

                    await this.sendReply(userId, replyText);
                    await db.collection("accounting").add(entry);
                    await discordService.sendDiscordNotification(replyText);
                    return;
                }
            }
        }

        const parsedData = await parseUserInput(userText, historyContext);

        if (parsedData.isError) {
            await this.sendReply(userId, `⚠️ 解析失敗：\n${parsedData.errorMessage}`);
            return;
        }

        if (parsedData.type === "accounting" && (parsedData.accountingData || parsedData.accountingDataList)) {
            const list = parsedData.accountingDataList || (parsedData.accountingData ? [parsedData.accountingData] : []);

            if (list.length === 0) {
                await this.sendReply(userId, "⚠️ AI 判斷為記帳，但無法解析出有效金額與項目，請重新描述 (例如: 早餐 100)。");
                return;
            }

            const batch = db.batch();
            let totalReplyText = "";
            let totalExpense = 0;
            let firstExpenseTag = "";

            for (const item of list) {
                const docRef = db.collection("accounting").doc();
                const entry: AccountingEntry = {
                    ...item,
                    originalText: userText,
                    source: "line",
                    createdAt: new Date(),
                };
                const isIncome = entry.tag === "Income";
                let replyText = `✅ ${isIncome ? "入帳記錄" : "記帳"}成功！\n💰 金額: $${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}`;

                batch.set(docRef, entry);

                if (!isIncome) {
                    totalExpense += entry.amount;
                    if (!firstExpenseTag) firstExpenseTag = entry.tag;
                }

                // 學習新規則 (C9) - 使用 catch 不等待
                if (entry.tag && entry.tag !== "Other") {
                    ClassificationEngine.learn(entry.description || userText, entry.tag, entry.subTag).catch(() => { });
                }

                totalReplyText += replyText + "\n\n";
            }

            await batch.commit();

            // 預算超支警報（針對同一批次的總花費只觸發一次）
            if (totalExpense > 0 && firstExpenseTag) {
                checkBudgetAlert(userId, totalExpense, list[0].date, firstExpenseTag).catch(() => { /* 不影響主流程 */ });
            }

            if (parsedData.explanation) {
                totalReplyText += `🤖 AI: ${parsedData.explanation}`;
            }

            const finalReply = totalReplyText.trim();
            await this.sendReply(userId, finalReply);
            await discordService.sendDiscordNotification(finalReply);

        } else if (parsedData.type === "archive" && parsedData.archiveData) {
            const embeddingText = `${parsedData.archiveData.summary} ${parsedData.archiveData.keywords.join(", ")}`;
            const embeddingArray = await getEmbedding(embeddingText).catch(e => {
                console.error("[Embedding] Failed:", e);
                return null;
            });

            const entry: ArchiveEntry & { embedding?: number[] } = {
                ...parsedData.archiveData,
                originalText: userText,
                source: "line",
                createdAt: new Date(),
            };
            if (embeddingArray) {
                entry.embedding = embeddingArray;
            }
            let replyText = `📦 收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}`;
            if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

            await this.sendReply(userId, replyText);
            await db.collection("archive").add(entry);
            await discordService.sendDiscordNotification(replyText);

            // 學習新標籤
            if (entry.keywords && entry.keywords.length > 0) {
                await ArchiveTagEngine.learn(entry.keywords);
            }

        } else if (parsedData.type === "calendar" && parsedData.calendarData) {
            const entry: CalendarEntry = {
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

            await this.sendReply(userId, replyText);
            await db.collection("calendar").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else if (parsedData.type === "recurring" && parsedData.recurringData) {
            const entry: RecurringExpense = {
                ...parsedData.recurringData,
                originalText: userText,
                source: "line",
                createdAt: new Date(),
                isActive: true,
            } as RecurringExpense;

            let freqStr: string = entry.frequency;
            if (entry.frequency === "monthly" && entry.dayOfMonth) freqStr = `每月 ${entry.dayOfMonth} 號`;
            else if (entry.frequency === "weekly" && entry.dayOfWeek !== undefined) freqStr = `每週的第 ${entry.dayOfWeek} 天`;

            let replyText = `🔄 定期支出設定成功！\n💰 金額: $${entry.amount}\n📝 項目: ${entry.description}\n🏷️ 標籤: ${entry.tag}\n⏳ 頻率: ${freqStr}`;
            if (parsedData.explanation) replyText += `\n🤖 AI: ${parsedData.explanation}`;

            await this.sendReply(userId, replyText);
            await db.collection("recurring_expenses").add(entry);
            await discordService.sendDiscordNotification(replyText);

        } else if (parsedData.type === "query" && parsedData.queryData) {
            const queryResult = await executeQuery(parsedData.queryData);
            await this.sendReply(userId, queryResult.replyText);

        } else if (parsedData.type === "clear_memory") {
            chatSessionManager.clearSession(userId);
            await this.sendReply(userId, "✅ 對話記憶已清除。我們可以重新開始對話了！");

        } else {
            // Fallback: Dispatch to Chat Session (Context Memory)
            try {
                // If the user hasn't specified anything specific, send it to general chat with context memory
                const session = chatSessionManager.getOrCreateSession(userId);
                const response = await session.sendMessage(userText);
                const replyText = response.response.text() || "抱歉，我無法提供回答。";
                await this.sendReply(userId, replyText);
            } catch (err) {
                console.error("[ChatSession] Error:", err);
                await this.sendReply(userId, "❓ 無法解析您的意圖，請試試：\n「吃飯花了 150」\n「收到薪水 50000」\n「明天下午三點開會」\n「每月10號付家裡伙食費7000」\n「這個連結很有趣 https://...」\n\n💡 也可以用 /help 查看快速指令");
            }
        }
    }

    /** 處理圖片訊息（上傳 Drive + Gemini Vision 分析） */
    async handleImageMessage(messageId: string, userId: string): Promise<void> {
        SessionService.addMessage(userId, "user", "[上傳了一張圖片]").catch(console.error);

        // 先回覆「處理中」讓使用者知道收到了
        await this.sendReply(userId, "🖼️ 收到圖片，分析中...");

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
            await this.sendReply(userId, `⚠️ 圖片分析失敗：${parsedData.errorMessage}\n📁 圖片已存到 Drive：${driveUrl}`);
            return;
        }

        if (parsedData.type === "accounting" && parsedData.accountingData) {
            const entry: AccountingEntry = {
                ...parsedData.accountingData,
                originalText: "[圖片分析]",
                imageUrl: driveUrl,
                source: "line-image",
                createdAt: new Date(),
            };
            const replyText = `✅ 收據記帳成功！\n💰 金額: $${entry.amount}\n🏷️ 標籤: ${entry.tag}\n📅 日期: ${entry.date}\n📁 圖片: 已存 Drive`;

            await this.sendReply(userId, replyText);
            await db.collection("accounting").add(entry);
            await discordService.sendDiscordNotification(replyText);

            // 學習新規則 (C9)
            if (entry.tag && entry.tag !== "Other" && (entry as any).description) {
                await ClassificationEngine.learn((entry as any).description, entry.tag, (entry as any).subTag);
            }

        } else if (parsedData.type === "archive" && parsedData.archiveData) {
            const embeddingText = `${parsedData.archiveData.summary} ${parsedData.archiveData.keywords.join(", ")}`;
            const embeddingArray = await getEmbedding(embeddingText).catch(e => {
                console.error("[Embedding] Failed:", e);
                return null;
            });

            const entry: ArchiveEntry & { embedding?: number[], imageUrl?: string } = {
                ...parsedData.archiveData,
                originalText: "[圖片分析]",
                imageUrl: driveUrl,
                source: "line-image",
                createdAt: new Date(),
            };
            if (embeddingArray) {
                entry.embedding = embeddingArray;
            }
            const replyText = `📦 圖片收納成功！\n📋 摘要: ${entry.summary}\n🏷️ 關鍵字: ${entry.keywords.join(", ")}\n📁 圖片: 已存 Drive`;

            await this.sendReply(userId, replyText);
            await db.collection("archive").add(entry);
            await discordService.sendDiscordNotification(replyText);

            // 學習新標籤
            if (entry.keywords && entry.keywords.length > 0) {
                await ArchiveTagEngine.learn(entry.keywords);
            }

        } else {
            await this.sendReply(userId, `❓ 無法辨識圖片內容\n📁 圖片已存 Drive：${driveUrl}`);
        }
    }

    /** 處理檔案訊息（如 PDF、DOCX，上傳 Drive 並記錄到知識庫） */
    async handleFileMessage(messageId: string, fileName: string, userId: string): Promise<void> {
        SessionService.addMessage(userId, "user", `[上傳了檔案: ${fileName}]`).catch(console.error);

        await this.sendReply(userId, "📁 收到檔案，上傳至雲端硬碟與 AI 知識庫中...");

        try {
            const fileBuffer = await lineService.getMessageContentBuffer(messageId);

            // 上傳到 Drive，自動判斷 MIME type -> (使用預設或省略)
            const driveUrl = await driveService.uploadToDrive(fileName, "application/octet-stream", fileBuffer);

            // 寫入本地 tmp 暫存區，然後交給 FileManager 上傳至 Gemini RAG
            let aiStatusStr = "已存入 AI 知識庫";
            try {
                const tmpPath = path.join(os.tmpdir(), `${messageId}_${fileName}`);
                await fs.writeFile(tmpPath, fileBuffer);
                const geminiSuccess = await FileManager.uploadToSearchStore(tmpPath, userId, fileName);
                await fs.unlink(tmpPath).catch(() => { });
                if (!geminiSuccess) {
                    aiStatusStr = "寫入 AI 知識庫失敗";
                }
            } catch (fileErr) {
                console.error("[FileManager] error for file upload:", fileErr);
                aiStatusStr = "寫入 AI 知識庫發生異常";
            }

            const embeddingText = `檔案: ${fileName} 此檔案由 LINE 機器人上傳，尚未提供詳細解析。`;
            const embeddingArray = await getEmbedding(embeddingText).catch(e => {
                console.error("[Embedding] Failed:", e);
                return null;
            });

            const entry: ArchiveEntry & { embedding?: number[] } = {
                title: fileName,
                summary: `此檔案由 LINE 機器人上傳。(${aiStatusStr})`,
                keywords: ["file", "document"],
                originalText: `[檔案上傳: ${fileName}]`,
                url: driveUrl,
                source: "line-file",
                createdAt: new Date(),
            };
            if (embeddingArray) {
                entry.embedding = embeddingArray;
            }

            const replyText = `✅ 檔案儲存成功！\n📁 標題：${fileName}\n🔗 存檔位置：已存 Drive\n🤖 AI 知識庫：${aiStatusStr}\n💡 您現在可以直接詢問我檔案內容了！`;

            await db.collection("archive").add(entry);
            await this.sendReply(userId, replyText);
            await discordService.sendDiscordNotification(replyText);

        } catch (e: unknown) {
            console.error("handleFileMessage error:", e);
            await this.sendReply(userId, "⚠️ 檔案處理失敗，請稍後再試。");
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
                await this.sendReply(userId, `⚠️ 處理失敗：${error?.message?.slice(0, 100) ?? "未知錯誤"}`);
            } catch {
                // push message 失敗則靜默
            }
        }
    }
}

export const messageService = new MessageService();
