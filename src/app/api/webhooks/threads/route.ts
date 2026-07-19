import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { ThreadsEntrySchema } from "@/models/schema";
import { threadsRetentionCutoff } from "@/utils/constants";

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        const expectedToken = process.env.CRON_SECRET;
        if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        // webhook parser for threads-scraper
        // It initially sends generic payload, we map it to ThreadsEntry
        const webhookType = body.type;

        if (webhookType === "test") {
            return NextResponse.json({ status: "ok", message: "Test connection successful" });
        }

        if (webhookType === "new_post") {
            const post = body.post;
            if (!post) {
                return NextResponse.json({ error: "Missing post data" }, { status: 400 });
            }

            // Map incoming data to our schema
            const matchedKeywords: string[] | undefined = body.matched_keywords;
            const mappedData = {
                threadId: post.id,
                threadUrl: post.url,
                author: post.username,
                content: post.text,
                publishedAt: post.published_on || new Date().toISOString(),
                likeCount: post.like_count || 0,
                replyCount: post.reply_count || 0,
                isDiscovery: false,
                matchedKeyword: matchedKeywords?.[0],
                source: "threads",
                originalText: post.text || "",
            };

            const parsedData = ThreadsEntrySchema.safeParse(mappedData);

            if (!parsedData.success) {
                console.warn("[Threads Webhook] Parsing failed:", parsedData.error);
                return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
            }

            const entry = parsedData.data;
            entry.createdAt = new Date();

            // 拒收超過保留天數的舊貼文（cleanup cron 會刪逾期資料，這裡擋住爬蟲重抓回來）
            if (entry.publishedAt < threadsRetentionCutoff()) {
                return NextResponse.json({ status: "skipped_old", threadId: entry.threadId });
            }

            // 去重：爬蟲端資料庫在 GitHub Actions 為暫時性，每次執行會重發相同貼文
            const dup = await db
                .collection("threads")
                .where("threadId", "==", entry.threadId)
                .limit(1)
                .get();
            if (!dup.empty) {
                return NextResponse.json({ status: "duplicate", threadId: entry.threadId });
            }

            await db.collection("threads").add(entry);

            // Notify via Line
            // (取代為每日彙整推播 /api/cron/threads-summary)
            // const message = `🧵 **Threads 新贴文** (@${entry.author})\n\n${entry.content}\n\n❤️ ${entry.likeCount} | 💬 ${entry.replyCount}\n🔗 ${entry.threadUrl}`;

            // const adminUserId = process.env.LINE_USER_ID;
            // if (adminUserId) {
            //     await lineService.pushText(adminUserId, message);
            // }

            return NextResponse.json({ status: "ok" });
        }

        return NextResponse.json({ status: "ignored", reason: "Unhandled webhook type" }, { status: 200 });

    } catch (error) {
        console.error("[Threads Webhook Error]:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
