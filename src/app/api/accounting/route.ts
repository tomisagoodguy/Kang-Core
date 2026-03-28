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

        // 不使用 orderBy 避免需要複合索引；排序改在 JS 端
        // 有 tag 過濾時先取全量再篩，避免分頁數量不足
        let baseQuery = adminDb
            .collection("accounting")
            .where("userId", "==", userId);

        if (tag && tag !== "all") {
            baseQuery = baseQuery.where("tag", "==", tag) as typeof baseQuery;
        }

        const query = tag && tag !== "all" ? baseQuery : baseQuery.limit(limit);

        const snapshot = await query.get();

        const entries: AccountingEntryView[] = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt:
                        data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : data.createdAt ?? null,
                } as AccountingEntryView;
            })
            .sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            })
            .slice(0, limit);

        return NextResponse.json({ entries, total: entries.length });
    } catch (error) {
        console.error("[API/accounting] Error:", error);
        return NextResponse.json({ error: "Failed to fetch accounting data" }, { status: 500 });
    }
}
