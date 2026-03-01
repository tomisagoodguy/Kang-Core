import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { getTagEmoji } from "@/utils/tagEmoji";

/**
 * 每日消費摘要推播
 * Vercel Cron: 0 13 * * * (UTC) → 21:00 UTC+8
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
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        // 今日消費
        const todaySnap = await db
            .collection("accounting")
            .where("date", "==", today)
            .get();

        const todayEntries = todaySnap.docs.map((d) => d.data());
        const todayTotal = todayEntries.reduce((s, e) => s + ((e.amount as number) || 0), 0);

        // 本月累計
        const monthSnap = await db
            .collection("accounting")
            .where("date", ">=", monthStart)
            .where("date", "<=", today)
            .get();

        const monthTotal = monthSnap.docs.reduce((s, d) => s + ((d.data().amount as number) || 0), 0);

        // 標籤統計
        const tagMap = new Map<string, number>();
        todayEntries.forEach((e) => {
            const tag = (e.tag as string) || "Other";
            tagMap.set(tag, (tagMap.get(tag) || 0) + ((e.amount as number) || 0));
        });

        const tagLines = Array.from(tagMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, amt]) => `${getTagEmoji(tag)} ${tag}: $${amt.toLocaleString()}`);

        if (todayEntries.length === 0) {
            await lineService.pushText(userId, [
                "📊 今日消費摘要",
                "━━━━━━━━━━━━",
                "🎉 今天零消費！",
                "",
                `📅 本月累計: $${monthTotal.toLocaleString()}`,
            ].join("\n"));
        } else {
            await lineService.pushText(userId, [
                "📊 今日消費摘要",
                "━━━━━━━━━━━━",
                `💰 今日共 ${todayEntries.length} 筆，合計 $${todayTotal.toLocaleString()}`,
                ...tagLines,
                "",
                `📅 本月累計: $${monthTotal.toLocaleString()}`,
            ].join("\n"));
        }

        return NextResponse.json({ status: "ok", todayTotal, monthTotal });
    } catch (err) {
        console.error("[daily-summary] Error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
