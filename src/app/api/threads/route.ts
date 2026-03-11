import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { ThreadsEntryView } from "@/models/schema";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limitStr = searchParams.get("limit") || "100";
        const q = searchParams.get("q")?.toLowerCase() || "";
        const limit = parseInt(limitStr, 10);

        // Simplified fetch, filtering will be done mostly in-memory here if simple
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
