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

        // 複合索引已建：userId+createdAt DESC、userId+tag+createdAt DESC（firestore.indexes.json）
        // 必須先 orderBy 再 limit，否則 Firestore 按文件 ID 取前 N 筆，新資料會被截掉
        let baseQuery = adminDb
            .collection("accounting")
            .where("userId", "==", userId);

        if (tag && tag !== "all") {
            baseQuery = baseQuery.where("tag", "==", tag) as typeof baseQuery;
        }

        const snapshot = await baseQuery.orderBy("createdAt", "desc").limit(limit).get();

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
