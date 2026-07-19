import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import type { CashTransactionView } from "@/models/schema";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("cash_transactions")
            .where("userId", "==", userId)
            .get();
        const ts = (v: unknown) => (v as { toMillis?: () => number })?.toMillis?.() ?? (v ? new Date(v as string).getTime() : 0);
        const docs: CashTransactionView[] = snapshot.docs
            .sort((a, b) => ts(b.data().createdAt) - ts(a.data().createdAt))
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                } as CashTransactionView;
            });
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/cash-account/transactions error:", error);
        return NextResponse.json({ error: "Failed to fetch cash transactions" }, { status: 500 });
    }
}
