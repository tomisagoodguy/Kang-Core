import { NextResponse } from "next/server";
import { lineService } from "@/services/line.service";
import { getAllLineUserIds } from "@/lib/userRegistry";

/**
 * 晚間日記提示推播
 * Vercel Cron: 30 14 * * * (UTC) → 台灣時間 22:30
 *
 * 推播後，使用者若回覆，Gemini parser 會優先判斷為 archive（日記）
 * archiveData.keywords 中加入 ["diary", today] 作為日記標識
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getAllLineUserIds();
    if (userIds.length === 0) {
        return NextResponse.json({ error: "LINE_USER_IDS not set" }, { status: 500 });
    }

    try {
        const today = new Date().toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });

        const diaryMessage = [
            "🌙 每日日記時間",
            "━━━━━━━━━━━━",
            `📅 ${today}`,
            "",
            "今天有什麼值得記下來的嗎？",
            "不論是靈感、心情、有趣的事...",
            "",
            "直接打字給我，我幫你整理收藏！",
            "（或傳截圖、連結也可以）",
        ].join("\n");

        for (const userId of userIds) {
            await lineService.pushText(userId, diaryMessage);
        }

        return NextResponse.json({ status: "ok", usersNotified: userIds.length });
    } catch (err) {
        console.error("[diary-prompt] Error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
