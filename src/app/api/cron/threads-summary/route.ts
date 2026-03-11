import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { getGeminiModel, safeExecute } from "@/lib/gemini/client";

/**
 * Threads 每日彙整推播
 * Vercel Cron: 0 12 * * * (UTC) → 20:00 UTC+8 (每天晚上8點推播)
 */
export async function GET(req: Request) {
    // 驗證 Cron 密鑰
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = process.env.LINE_USER_ID;
    if (!userId) {
        return NextResponse.json({ error: "LINE_USER_ID not set" }, { status: 500 });
    }

    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 取得過去 24 小時內的 Threads 貼文
        const snapshot = await db
            .collection("threads")
            .where("createdAt", ">=", yesterday)
            .orderBy("createdAt", "desc")
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ status: "ok", message: "No new threads in the last 24 hours" });
        }

        const entries = snapshot.docs.map((doc) => doc.data());

        // 準備要餵給 AI 的內容
        const contentToSummarize = entries.map((e, index) => {
            return `[${index + 1}] 作者: @${e.author}\n貼文內容: ${e.content}\n讚數: ${e.likeCount} | 回覆數: ${e.replyCount}\nURL: ${e.threadUrl}`;
        }).join("\n\n---\n\n");

        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set. Cannot summarize.");
            return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
        }

        // 使用 Gemini 進行摘要
        const model = getGeminiModel("gemini-2.5-flash");

        const systemPrompt = `你是一個專業的科技與軟體開發資訊助理，具備資深產品經理與架構師的敏銳度。
使用者會提供你過去 24 小時內爬取到的 Threads 貼文內容（包含作者、內容、互動數據等）。
你的任務是將這些文章整理成一份「今日科技資訊摘要」，請你「貪心一點」，同時提供【話題總結】與【Top 5 必讀推薦】。

請嚴格遵循以下格式與規則（請使用繁體中文）：

1. **模組化輸出結構**：
   首先，以「📊 **本日話題趨勢總結**」為標題，根據貼文內容，將它們分類（例如：AI 趨勢、軟體開發、業界新聞、前端技術等），用列點的方式歸納出大家今天都在討論什麼核心議題。保持精簡、易讀，不要長篇大論。

2. **精選 Top 5**：
   接著，以「🏆 **精選 Top 5 必讀貼文**」為標題。
   根據貼文的技術含金量、實用性以及互動數（讚、留言），嚴格挑選出最有價值的 5 篇文章。
   格式必須為：
   🥇 1. [作者] (簡短的一句話重點標題) - @作者帳號
   💡 核心看點：(1~2句話總結為什麼這篇值得看)
   🔗 連結：(貼文URL)

   🥈 2. [作者] ... (以此類推，直到第5名)

3. **結語**：
   不用任何開場白或額外的問候語，嚴格直接輸出上述兩個區塊。排版要乾淨，適當使用 Emoji 點綴，因為這是要發送到 LINE 上的訊息，請確保易讀性。`;

        const prompt = `${systemPrompt}\n\n=== 貼文資料 ===\n${contentToSummarize}`;

        // 執行 AI 彙整
        const result = await safeExecute(() => model.generateContent(prompt));
        const summaryText = result.response.text();

        // 組合最終訊息
        const finalMessage = `🧵 **Threads 每日科技精華**\n\n${summaryText.trim()}`;

        // 推播至 LINE
        // 將推播送出 (非同步或是 awaiting)
        await lineService.pushText(userId, finalMessage);

        // --- 🤖 自動清理機制 ---
        // 刪除 超過 7 天 且「未被釘選保留 (isSaved)」的廢文
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oldSnapshot = await db
            .collection("threads")
            .where("createdAt", "<", sevenDaysAgo)
            .get();

        let deletedCount = 0;
        if (!oldSnapshot.empty) {
            const batch = db.batch();
            let batchCount = 0;
            oldSnapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.isSaved !== true) {
                    batch.delete(doc.ref);
                    deletedCount++;
                    batchCount++;
                }
            });

            // Firebase batch 最多 500 筆，若超過會出錯，這裡簡單防呆處理
            if (batchCount > 0 && batchCount <= 500) {
                await batch.commit();
                console.log(`[threads-summary] Auto-deleted ${deletedCount} old threads.`);
            } else if (batchCount > 500) {
                // 如果量超大就一筆一筆刪
                for (const doc of oldSnapshot.docs) {
                    if (doc.data().isSaved !== true) {
                        await doc.ref.delete();
                    }
                }
                console.log(`[threads-summary] Auto-deleted ${deletedCount} old threads loop.`);
            }
        }

        return NextResponse.json({
            status: "ok",
            processedCount: entries.length,
            deletedCount: deletedCount,
            message: "Summary pushed to LINE, old threads cleaned up."
        });

    } catch (err) {
        console.error("[threads-summary] Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
