import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { ThreadsEntrySchema } from "@/models/schema";

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

            // Map incoming data to our schema
            const mappedData = {
                threadId: post.id,
                threadUrl: post.url,
                author: post.username,
                content: post.text,
                publishedAt: post.published_on || new Date().toISOString(),
                likeCount: post.like_count || 0,
                replyCount: post.reply_count || 0,
                isDiscovery: false,
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

            // Store in Firestore
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
