import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

/**
 * GET /api/threads/config
 * 供 Python threads-scraper 動態讀取 LINE Bot 管理的追蹤名單
 * 爬蟲合併此清單 + config.yaml 一起執行
 */
export async function GET(req: Request) {
    // 簡單 API Key 驗證（用 CRON_SECRET 複用即可）
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [usersSnapshot, topicsSnapshot] = await Promise.all([
            db.collection("threads_users").orderBy("addedAt", "asc").get(),
            db.collection("threads_topics").orderBy("addedAt", "asc").get(),
        ]);

        const users = usersSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                username: data.username as string,
                maxPosts: (data.maxPosts as number) ?? 10,
                addedAt: data.addedAt?.toDate?.()?.toISOString() ?? null,
                source: (data.source as string) ?? "line-bot",
            };
        });

        const topics = topicsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                keyword: data.keyword as string,
                addedAt: data.addedAt?.toDate?.()?.toISOString() ?? null,
                source: (data.source as string) ?? "line-bot",
            };
        });

        return NextResponse.json({
            users,
            topics,
            count: users.length,
            updatedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error("[threads/config] Failed:", e);
        return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
    }
}
