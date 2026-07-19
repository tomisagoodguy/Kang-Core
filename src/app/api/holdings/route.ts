import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import type { HoldingView } from "@/models/schema";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("holdings")
            .where("userId", "==", userId)
            .get();
        const docs: HoldingView[] = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
                } as HoldingView;
            })
            .filter((h) => h.shares > 0)
            .sort((a, b) => `${a.market}${a.ticker}`.localeCompare(`${b.market}${b.ticker}`));
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/holdings error:", error);
        return NextResponse.json({ error: "Failed to fetch holdings" }, { status: 500 });
    }
}
