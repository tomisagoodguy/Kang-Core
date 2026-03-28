import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { getAllLineUserIds } from "@/lib/userRegistry";

/**
 * 每日行事曆提醒推播
 * Vercel Cron: 0 0 * * * (UTC) → 08:00 UTC+8
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

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<{ userId: string; eventsCount: number }> = [];

    for (const userId of userIds) {
        try {
            // 今日行程
            const calSnap = await db
                .collection("calendar")
                .where("userId", "==", userId)
                .where("actionDate", "==", today)
                .get();

            const events = calSnap.docs.map((d) => d.data());

            // 待辦（無日期的 pending）
            const pendingSnap = await db
                .collection("calendar")
                .where("userId", "==", userId)
                .where("status", "==", "pending")
                .get();

            const pendingNoDates = pendingSnap.docs
                .filter((d) => !d.data().actionDate)
                .map((d) => d.data());

            if (events.length === 0 && pendingNoDates.length === 0) {
                results.push({ userId, eventsCount: 0 });
                continue;
            }

            const eventLines = events.map((e) => {
                const time = (e.actionTime as string) ? `⏰ ${e.actionTime} ` : "📌 ";
                const status = (e.status as string) === "done" ? " ✅" : "";
                return `${time}${e.title}${status}`;
            });

            const todoLines = pendingNoDates.slice(0, 5).map((e) => `📌 ${e.title}`);

            const sections: string[] = [];
            if (eventLines.length > 0) {
                sections.push(...eventLines);
            }
            if (todoLines.length > 0) {
                if (sections.length > 0) sections.push("");
                sections.push("📋 待辦事項", ...todoLines);
            }

            await lineService.pushText(userId, [
                "🗓 今日行程提醒",
                "━━━━━━━━━━━━",
                ...sections,
            ].join("\n"));

            results.push({ userId, eventsCount: events.length });
        } catch (err) {
            console.error(`[calendar-remind] Error for user ${userId}:`, err);
        }
    }

    return NextResponse.json({ status: "ok", results });
}
