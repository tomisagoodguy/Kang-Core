import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { ThreadsEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET(req: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const limitStr = searchParams.get("limit") || "100";
        const q = searchParams.get("q")?.toLowerCase() || "";
        const limit = Math.min(parseInt(limitStr, 10) || 100, 200);

        // TODO: threads 集合由爬蟲寫入，目前不含 userId 欄位，為全域共享資料。
        // 正式隔離需更新爬蟲 webhook 以帶入 userId，並建立對應的 Firestore 複合索引。
        const snapshot = await db
            .collection("threads")
            .orderBy("publishedAt", "desc")
            .limit(limit)
            .get();

        let entries = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : null,
            } as ThreadsEntryView;
        });

        if (q) {
            entries = entries.filter(
                (e) =>
                    e.content.toLowerCase().includes(q) ||
                    e.author.toLowerCase().includes(q)
            );
        }

        return NextResponse.json({ entries });
    } catch (e) {
        console.error("[GET /api/threads] Error:", e);
        return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
    }
}
