import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { NetWorthService } from "@/services/netWorth.service";
import type { NetWorthSnapshotView } from "@/models/schema";
import { z } from "zod";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("net_worth_snapshots")
            .where("userId", "==", userId)
            .get();
        const docs: NetWorthSnapshotView[] = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as NetWorthSnapshotView;
            })
            // 依 date（快照代表日）由舊到新排序，而非建立順序
            .sort((a, b) => a.date.localeCompare(b.date));
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/net-worth error:", error);
        return NextResponse.json({ error: "Failed to fetch net worth snapshots" }, { status: 500 });
    }
}

const CreateSnapshotSchema = z.object({
    date: z.string(),
    // cashBalance 不再由前端傳入，一律由伺服器從 cash_accounts 即時餘額取得
});

export async function POST(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();
        const result = CreateSnapshotSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const { date } = result.data;
        const created = await NetWorthService.createSnapshot(userId, date);

        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error("POST /api/net-worth error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
