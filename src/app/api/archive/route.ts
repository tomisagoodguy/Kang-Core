import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const q = searchParams.get("q")?.toLowerCase();

        const snapshot = await adminDb
            .collection("archive")
            .orderBy("createdAt", "desc")
            .limit(q ? 100 : limit) // fetch more for client-side keyword filter
            .get();

        let entries = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : data.createdAt ?? null,
            };
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
            // Re-apply limit after filter
            entries = entries.slice(0, limit);
        }

        return NextResponse.json({ entries, total: entries.length });
    } catch (error) {
        console.error("[API/archive] Error:", error);
        return NextResponse.json({ error: "Failed to fetch archive data" }, { status: 500 });
    }
}
