import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { InvestmentTransactionSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { z } from "zod";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("investment_transactions")
            .where("userId", "==", userId)
            .get();
        const ts = (v: unknown) => (v as { toMillis?: () => number })?.toMillis?.() ?? (v ? new Date(v as string).getTime() : 0);
        const docs = snapshot.docs
            .sort((a, b) => ts(b.data().createdAt) - ts(a.data().createdAt))
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                };
            });
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/holdings/transactions error:", error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}

const CreateTransactionSchema = InvestmentTransactionSchema.omit({
    id: true,
    createdAt: true,
    source: true,
    originalText: true,
    userId: true,
    linkedAccountingEntryId: true,
}).extend({
    // 這筆交易是否為「今天實際發生」，需要即時反映到現金餘額；
    // 補登已持有多年的舊部位、或現金早已在其他地方入帳過，請設為 false（預設）
    affectsCash: z.boolean().default(false),
});

export async function POST(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();
        const result = CreateTransactionSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const { market, ticker, name, side, shares, pricePerShare, fee, date, affectsCash } = result.data;
        const holdingId = `${userId}_${market}_${ticker}`;
        const holdingRef = db.collection("holdings").doc(holdingId);
        const txRef = db.collection("investment_transactions").doc();
        const cashAccountRef = db.collection("cash_accounts").doc(userId);
        const cashTxRef = db.collection("cash_transactions").doc();

        await db.runTransaction(async (t) => {
            const holdingSnap = await t.get(holdingRef);
            const holding = holdingSnap.exists ? holdingSnap.data()! : { shares: 0, avgCost: 0 };

            let newShares: number;
            let newAvgCost: number;

            if (side === "buy") {
                newShares = holding.shares + shares;
                newAvgCost = (holding.shares * holding.avgCost + shares * pricePerShare + fee) / newShares;
            } else {
                if (shares > holding.shares) {
                    throw new Error("OVERSELL");
                }
                newShares = holding.shares - shares;
                newAvgCost = holding.avgCost; // 賣出不變動平均成本
            }

            t.set(holdingRef, {
                userId,
                market,
                ticker,
                name: name ?? holding.name ?? null,
                shares: newShares,
                avgCost: newAvgCost,
                currentPrice: holding.currentPrice ?? null,
                priceAsOf: holding.priceAsOf ?? null,
                updatedAt: new Date(),
            }, { merge: true });

            // 買賣股票是現金 ↔ 投資的資產轉移，不算收支，只影響現金餘額（不寫入 accounting）
            if (affectsCash) {
                const cashAccountSnap = await t.get(cashAccountRef);
                const currentBalance = cashAccountSnap.exists ? cashAccountSnap.data()!.balance ?? 0 : 0;
                const delta = side === "buy" ? -(shares * pricePerShare + fee) : shares * pricePerShare - fee;
                t.set(cashAccountRef, { userId, balance: currentBalance + delta, updatedAt: new Date() }, { merge: true });
                t.set(cashTxRef, {
                    userId,
                    type: side === "buy" ? "investment_buy" : "investment_sell",
                    amount: delta,
                    description: `${name || ticker} ${side === "buy" ? "買入" : "賣出"} ${shares}股`,
                    date,
                    linkedInvestmentTransactionId: txRef.id,
                    createdAt: new Date(),
                });
            }

            t.set(txRef, {
                userId,
                market,
                ticker,
                name: name ?? null,
                side,
                shares,
                pricePerShare,
                fee,
                date,
                source: "manual",
                originalText: `Dashboard: ${side} ${market} ${ticker}`,
                createdAt: new Date(),
            });
        });

        return NextResponse.json({ id: txRef.id }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "OVERSELL") {
            return NextResponse.json({ error: "賣出股數超過目前持股" }, { status: 400 });
        }
        console.error("POST /api/holdings/transactions error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
