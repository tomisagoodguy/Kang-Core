import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import type { CreditCardBillView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("credit_card_bills")
            .where("userId", "==", userId)
            .get();
        const docs = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
                } as CreditCardBillView;
            })
            .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/credit-card-bills error:", error);
        return NextResponse.json({ error: "Failed to fetch credit card bills" }, { status: 500 });
    }
}
