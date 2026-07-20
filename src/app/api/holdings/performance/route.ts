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
const RISK_FREE_RATE = 0.015; // 粗估無風險利率（台灣定存/公債參考值），非即時抓取
const MIN_PERIODS_FOR_RISK = 3; // 至少 3 期報酬率才計算波動度／Sharpe/最大回撤，避免樣本太少誤導

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

interface SnapshotPoint {
    date: string; // YYYY-MM-DD
    investmentValueTWD: number;
}

interface RiskMetrics {
    twrPct: number; // 年化 TWR（時間加權報酬率，%）
    volatilityPct: number; // 年化波動度（%）
    sharpe: number;
    maxDrawdownPct: number; // 最大回撤（%，負值）
    periodsUsed: number;
}

/**
 * TWR（時間加權報酬率）+ 波動度 + Sharpe + 最大回撤
 * 資料來源：net_worth_snapshots 的月度 investmentValueTWD 序列，用 investment_transactions
 * 現金流做 Modified-Dietz-lite 校正（假設當期買賣發生在期末，月度粒度下為合理近似）。
 * 限制：只有從淨值快照開始累積的月份可用，快照太少（<3 期報酬率）不提供風險指標。
 */
function computeRiskMetrics(snapshots: SnapshotPoint[], flows: CashFlow[]): RiskMetrics | null {
    if (snapshots.length < 2) return null;

    const periodReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1];
        const curr = snapshots[i];
        if (prev.investmentValueTWD <= 0) continue; // 前一期無持股，報酬率無意義

        const netFlow = flows
            .filter((f) => f.date > new Date(prev.date) && f.date <= new Date(curr.date))
            .reduce((sum, f) => sum - f.amount, 0); // flows 的 amount 買入為負，這裡要「流入投資組合的淨額」故取負號加總

        const r = (curr.investmentValueTWD - netFlow) / prev.investmentValueTWD - 1;
        if (Number.isFinite(r)) periodReturns.push(r);
    }

    if (periodReturns.length < MIN_PERIODS_FOR_RISK) return null;

    const firstDate = new Date(snapshots[0].date);
    const lastDate = new Date(snapshots[snapshots.length - 1].date);
    const years = (lastDate.getTime() - firstDate.getTime()) / MS_PER_YEAR;
    if (years <= 0) return null;

    const cumulativeGrowth = periodReturns.reduce((acc, r) => acc * (1 + r), 1);
    const twr = Math.pow(cumulativeGrowth, 1 / years) - 1;

    const meanReturn = periodReturns.reduce((s, r) => s + r, 0) / periodReturns.length;
    const variance = periodReturns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / periodReturns.length;
    const monthlyVolatility = Math.sqrt(variance);
    const annualizedVolatility = monthlyVolatility * Math.sqrt(12);

    const sharpe = annualizedVolatility > 0 ? (twr - RISK_FREE_RATE) / annualizedVolatility : 0;

    let runningMax = 1;
    let index = 1;
    let maxDrawdown = 0;
    for (const r of periodReturns) {
        index *= (1 + r);
        runningMax = Math.max(runningMax, index);
        maxDrawdown = Math.min(maxDrawdown, index / runningMax - 1);
    }

    return {
        twrPct: Math.round(twr * 1000) / 10,
        volatilityPct: Math.round(annualizedVolatility * 1000) / 10,
        sharpe: Math.round(sharpe * 100) / 100,
        maxDrawdownPct: Math.round(maxDrawdown * 1000) / 10,
        periodsUsed: periodReturns.length,
    };
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

        const txOnlyFlows = [...flows]; // 風險指標只需要買賣現金流，不含今日市值這筆合成流

        const marketValueTWD = await NetWorthService.computeInvestmentValueTWD(userId);
        const now = new Date();
        flows.push({ date: now, amount: marketValueTWD });

        const spanDays = firstDate
            ? (now.getTime() - new Date(firstDate).getTime()) / (24 * 60 * 60 * 1000)
            : 0;

        const snapshotsSnap = await db.collection("net_worth_snapshots")
            .where("userId", "==", userId)
            .get();
        const snapshots: SnapshotPoint[] = snapshotsSnap.docs
            .map((d) => d.data())
            .map((s) => ({ date: s.date as string, investmentValueTWD: (s.investmentValueTWD as number) ?? 0 }))
            .sort((a, b) => a.date.localeCompare(b.date));
        const riskMetrics = computeRiskMetrics(snapshots, txOnlyFlows);

        const summary = {
            totalInvestedTWD: Math.round(totalInvestedTWD),
            totalRecoveredTWD: Math.round(totalRecoveredTWD),
            marketValueTWD,
            since: firstDate,
            riskMetrics, // null 代表淨值快照月數不足（需要 ≥3 期報酬率）
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
