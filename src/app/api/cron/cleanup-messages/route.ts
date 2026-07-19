import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { threadsRetentionCutoff, THREADS_RETENTION_DAYS } from "@/utils/constants";

/**
 * 清理 7 天以上的 processed_messages 文件與逾期 Threads 貼文，避免 Firestore 儲存無限膨脹
 * Vercel Cron: 0 2 * * 0 (UTC) → 每週日 UTC 02:00
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const snapshot = await db
            .collection("processed_messages")
            .where("timestamp", "<", sevenDaysAgo)
            .limit(500) // 每次最多清 500 筆，避免超時
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }

        // 清理超過保留天數的 Threads 貼文（publishedAt 為 "YYYY-MM-DD HH:mm:ss" 字串，可直接比較）
        const cutoff = threadsRetentionCutoff();
        let threadsDeleted = 0;
        for (let i = 0; i < 4; i++) {
            const old = await db
                .collection("threads")
                .where("publishedAt", "<", cutoff)
                .limit(500)
                .get();
            if (old.empty) break;
            const batch = db.batch();
            old.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            threadsDeleted += old.size;
        }

        console.log(
            `[cleanup-messages] Deleted ${snapshot.size} processed_messages, ${threadsDeleted} threads posts older than ${THREADS_RETENTION_DAYS} days`
        );
        return NextResponse.json({
            status: "ok",
            deleted: snapshot.size,
            threadsDeleted,
        });
    } catch (err) {
        console.error("[cleanup-messages] Error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
