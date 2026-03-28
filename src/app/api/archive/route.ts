import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const q = searchParams.get("q")?.toLowerCase();

        // 不使用 orderBy 避免需要複合索引；排序改在 JS 端
        const snapshot = await adminDb
            .collection("archive")
            .where("userId", "==", userId)
            .get();

        let entries = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt:
                        data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : data.createdAt ?? null,
                };
            })
            .sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            });

        // Filter by keyword if provided
        if (q) {
            entries = entries.filter((entry: any) => {
                const keywordsMatch =
                    Array.isArray(entry.keywords) &&
                    entry.keywords.some((kw: string) => kw.toLowerCase().includes(q));
                const titleMatch = entry.title?.toLowerCase().includes(q);
                const summaryMatch = entry.summary?.toLowerCase().includes(q);
                return keywordsMatch || titleMatch || summaryMatch;
            });
        }

        entries = entries.slice(0, limit);

        return NextResponse.json({ entries, total: entries.length });
    } catch (error) {
        console.error("[API/archive] Error:", error);
        return NextResponse.json({ error: "Failed to fetch archive data" }, { status: 500 });
    }
}
