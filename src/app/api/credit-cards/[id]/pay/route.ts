import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import type { CreditCardBill } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

const PaySchema = z.object({
    amount: z.number().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * 信用卡繳款：FIFO 依帳單期別由舊到新沖銷未繳/部分繳清帳單
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const cardSnap = await requireOwnership("credit_cards", id, userId);
        if (!cardSnap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const result = PaySchema.safeParse(await request.json());
        if (!result.success) {
            return NextResponse.json({ error: "Invalid input", details: result.error.format() }, { status: 400 });
        }

        const billsSnap = await db.collection("credit_card_bills")
            .where("creditCardId", "==", id)
            .get();
        const bills = billsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as CreditCardBill & { id: string }))
            .filter(b => b.status !== "paid")
            .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)); // FIFO：期別最舊的先沖銷

        let remaining = result.data.amount;
        const appliedTo: Array<{ billId: string; applied: number; newStatus: string }> = [];
        const batch = db.batch();

        for (const bill of bills) {
            if (remaining <= 0) break;
            const owed = bill.totalAmount - bill.paidAmount;
            if (owed <= 0) continue;

            const applied = Math.min(remaining, owed);
            const newPaid = bill.paidAmount + applied;
            const newStatus = newPaid >= bill.totalAmount ? "paid" : "partial";

            batch.update(db.collection("credit_card_bills").doc(bill.id), {
                paidAmount: newPaid,
                status: newStatus,
                updatedAt: new Date(),
            });
            appliedTo.push({ billId: bill.id, applied, newStatus });
            remaining -= applied;
        }

        await batch.commit();

        return NextResponse.json({
            appliedTo,
            unallocatedAmount: remaining, // > 0 代表繳款金額超過所有未繳帳單，未被分配
        });
    } catch (error) {
        console.error("POST /api/credit-cards/[id]/pay error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
