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

        // 用「等值 + date 範圍、無 orderBy」查詢：Firestore 會自動合併單欄索引（zigzag merge），
        // 不需複合索引（專案的複合索引從未部署成功，orderBy 會直接 FAILED_PRECONDITION）。
        // 以近 400 天為下限界定資料量，排序與截斷在 JS 端做，確保拿到的是「最新」而非隨機文件。
        const dateFloor = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
        const snapshot = await adminDb
            .collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", dateFloor)
            .get();

        // tag 過濾在 JS 端做：再加一個等值條件就需要複合索引（本專案索引未部署）
        const entries: AccountingEntryView[] = snapshot.docs
            .filter((doc) => !tag || tag === "all" || doc.data().tag === tag)
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
                const dateCmp = (b.date ?? "").localeCompare(a.date ?? "");
                if (dateCmp !== 0) return dateCmp;
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
