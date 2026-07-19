import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { fetchRateToTWD } from "@/lib/exchangeRate";
import { NetWorthService } from "@/services/netWorth.service";

interface CashFlow {
    date: Date;
    amount: number; // TWD，流出（買入）為負、流入（賣出／期末市值）為正
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const MIN_SPAN_DAYS = 30; // 期間太短年化會爆炸，不提供 XIRR

/** 求 NPV(rate) = 0 的年化報酬率。二分法：區間內必有解才回傳，否則 null */
function solveXirr(flows: CashFlow[]): number | null {
    const t0 = Math.min(...flows.map((f) => f.date.getTime()));
    const years = (d: Date) => (d.getTime() - t0) / MS_PER_YEAR;
    const npv = (rate: number) =>
        flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, years(f.date)), 0);

    let lo = -0.999;
    let hi = 10;
    let npvLo = npv(lo);
    if (npvLo * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const npvMid = npv(mid);
        if (Math.abs(npvMid) < 1e-7) return mid;
        if (npvLo * npvMid < 0) {
            hi = mid;
        } else {
            lo = mid;
            npvLo = npvMid;
        }
    }
    return (lo + hi) / 2;
}

/**
 * 投資組合年化報酬率（XIRR）
 * 現金流 = 歷次買入（負）/ 賣出（正）+ 今日持股市值（正），全部換算台幣後求解
 * 限制：美股歷史交易以「目前」匯率換算（無歷史匯率資料），屬近似值
 */
export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const txSnap = await db.collection("investment_transactions")
            .where("userId", "==", userId)
            .get();

        if (txSnap.empty) {
            return NextResponse.json({ xirr: null, reason: "no_transactions" });
        }

        const usdRate = await fetchRateToTWD("USD");
        const flows: CashFlow[] = [];
        let totalInvestedTWD = 0;
        let totalRecoveredTWD = 0;
        let firstDate: string | null = null;

        for (const doc of txSnap.docs) {
            const tx = doc.data();
            const gross = (tx.shares ?? 0) * (tx.pricePerShare ?? 0);
            const fee = tx.fee ?? 0;
            const rate = tx.market === "US" ? usdRate : 1;
            const amountTWD = tx.side === "buy" ? -(gross + fee) * rate : (gross - fee) * rate;
            flows.push({ date: new Date(tx.date), amount: amountTWD });
            if (tx.side === "buy") totalInvestedTWD += (gross + fee) * rate;
            else totalRecoveredTWD += (gross - fee) * rate;
            if (!firstDate || tx.date < firstDate) firstDate = tx.date;
        }

        const marketValueTWD = await NetWorthService.computeInvestmentValueTWD(userId);
        const now = new Date();
        flows.push({ date: now, amount: marketValueTWD });

        const spanDays = firstDate
            ? (now.getTime() - new Date(firstDate).getTime()) / (24 * 60 * 60 * 1000)
            : 0;

        const summary = {
            totalInvestedTWD: Math.round(totalInvestedTWD),
            totalRecoveredTWD: Math.round(totalRecoveredTWD),
            marketValueTWD,
            since: firstDate,
        };

        if (spanDays < MIN_SPAN_DAYS) {
            return NextResponse.json({ xirr: null, reason: "insufficient_history", ...summary });
        }

        const xirr = solveXirr(flows);
        return NextResponse.json({ xirr, ...summary });
    } catch (error) {
        console.error("GET /api/holdings/performance error:", error);
        return NextResponse.json({ error: "Failed to compute performance" }, { status: 500 });
    }
}
