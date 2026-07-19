import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import type { CashAccountView } from "@/models/schema";
import { z } from "zod";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const doc = await db.collection("cash_accounts").doc(userId).get();
        const data = doc.data();
        const view: CashAccountView = {
            userId,
            balance: data?.balance ?? 0,
            updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
        };
        return NextResponse.json(view);
    } catch (error) {
        console.error("GET /api/cash-account error:", error);
        return NextResponse.json({ error: "Failed to fetch cash account" }, { status: 500 });
    }
}

const CreateCashTransactionSchema = z.object({
    type: z.enum(["deposit", "withdrawal", "adjustment"]),
    amount: z.number(), // deposit/withdrawal: 正數金額；adjustment: 校正後的絕對餘額
    description: z.string().optional(),
    date: z.string(),
});

export async function POST(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();
        const result = CreateCashTransactionSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const { type, amount, description, date } = result.data;
        const accountRef = db.collection("cash_accounts").doc(userId);
        const txRef = db.collection("cash_transactions").doc();

        const newBalance = await db.runTransaction(async (t) => {
            const accountSnap = await t.get(accountRef);
            const currentBalance = accountSnap.exists ? accountSnap.data()!.balance ?? 0 : 0;

            let delta: number;
            if (type === "deposit") delta = amount;
            else if (type === "withdrawal") delta = -amount;
            else delta = amount - currentBalance; // adjustment：amount 視為校正後的絕對餘額

            const updatedBalance = currentBalance + delta;

            t.set(accountRef, { userId, balance: updatedBalance, updatedAt: new Date() }, { merge: true });
            t.set(txRef, {
                userId,
                type,
                amount: delta,
                description: description ?? null,
                date,
                createdAt: new Date(),
            });

            return updatedBalance;
        });

        return NextResponse.json({ id: txRef.id, balance: newBalance }, { status: 201 });
    } catch (error) {
        console.error("POST /api/cash-account error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
