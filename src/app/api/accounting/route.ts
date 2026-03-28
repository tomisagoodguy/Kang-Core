import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { AccountingEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const tag = searchParams.get("tag");

        let query = adminDb
            .collection("accounting")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (tag && tag !== "all") {
            query = query.where("tag", "==", tag) as typeof query;
        }

        const snapshot = await query.get();

        const entries: AccountingEntryView[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : data.createdAt ?? null,
            } as AccountingEntryView;
        });

        return NextResponse.json({ entries, total: entries.length });
    } catch (error) {
        console.error("[API/accounting] Error:", error);
        return NextResponse.json({ error: "Failed to fetch accounting data" }, { status: 500 });
    }
}
