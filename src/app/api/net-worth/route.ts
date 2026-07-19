import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { fetchRateToTWD } from "@/lib/exchangeRate";
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
    cashBalance: z.number(),
    // 前端若傳這兩個欄位一律忽略，永遠由伺服器重新計算
});

async function computeInvestmentValueTWD(userId: string): Promise<number> {
    const holdingsSnap = await db.collection("holdings").where("userId", "==", userId).get();
    if (holdingsSnap.empty) return 0;

    const usdRate = await fetchRateToTWD("USD");
    let total = 0;
    for (const doc of holdingsSnap.docs) {
        const h = doc.data();
        const price = h.currentPrice ?? h.avgCost ?? 0;
        const marketValue = (h.shares ?? 0) * price;
        total += h.market === "US" ? marketValue * usdRate : marketValue;
    }
    return Math.round(total);
}

async function computeLoanBalance(userId: string): Promise<number> {
    const loansSnap = await db.collection("loans")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get();
    return loansSnap.docs.reduce((sum, doc) => sum + (doc.data().remainingPrincipal ?? 0), 0);
}

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

        const { date, cashBalance } = result.data;
        const [investmentValueTWD, loanBalance] = await Promise.all([
            computeInvestmentValueTWD(userId),
            computeLoanBalance(userId),
        ]);
        const netWorth = cashBalance + investmentValueTWD - loanBalance;

        const insertData = {
            userId,
            date,
            cashBalance,
            investmentValueTWD,
            loanBalance,
            netWorth,
            createdAt: new Date(),
        };

        const docRef = await db.collection("net_worth_snapshots").add(insertData);

        return NextResponse.json({ id: docRef.id, ...insertData }, { status: 201 });
    } catch (error) {
        console.error("POST /api/net-worth error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
