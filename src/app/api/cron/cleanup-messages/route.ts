import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

/**
 * 清理 7 天以上的 processed_messages 文件，避免 Firestore 儲存無限膨脹
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

        if (snapshot.empty) {
            return NextResponse.json({ status: "ok", deleted: 0 });
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        console.log(`[cleanup-messages] Deleted ${snapshot.size} old processed_messages`);
        return NextResponse.json({ status: "ok", deleted: snapshot.size });
    } catch (err) {
        console.error("[cleanup-messages] Error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
