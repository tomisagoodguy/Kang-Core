'use client';

import { useState, useEffect } from "react";
import type { HoldingView, LoanView, NetWorthSnapshotView, CashAccountView, TripView } from "@/models/schema";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { NetWorthTrendChart } from "@/components/charts/NetWorthTrendChart";
import { FireCalculator } from "@/components/FireCalculator";
import { CagrCalculator } from "@/components/CagrCalculator";

interface CashflowMonth {
    month: string;
    income: number;
    expense: number;
    net: number;
}

interface TravelStats {
    year: number;
    totalTWD: number;
    trips: TripView[];
    budget: number | null;
}

interface RiskMetrics {
    twrPct: number;
    volatilityPct: number;
    sharpe: number;
    maxDrawdownPct: number;
    periodsUsed: number;
}

interface PerformanceData {
    xirr: number | null;
    reason?: string;
    totalInvestedTWD?: number;
    totalRecoveredTWD?: number;
    marketValueTWD?: number;
    since?: string | null;
    riskMetrics?: RiskMetrics | null;
}

function daysSince(dateStr?: string): number | null {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// 台股標準預設值：手續費 0.1425%（不打折）；證交稅 ETF 0.1%、一般股票 0.3%
const TW_FEE_RATE = 0.001425;
const TW_TAX_RATE_ETF = 0.001;
const TW_TAX_RATE_STOCK = 0.003;

function isTwEtfTicker(ticker: string): boolean {
    return ticker.startsWith("00");
}

function computeHoldingMetrics(h: HoldingView) {
    const price = h.currentPrice ?? h.avgCost;
    const hasPrice = h.currentPrice != null;
    const investmentCost = h.shares * h.avgCost;
    const marketValue = h.shares * price;

    if (h.market === "TW") {
        const taxRate = isTwEtfTicker(h.ticker) ? TW_TAX_RATE_ETF : TW_TAX_RATE_STOCK;
        const sellCostRate = TW_FEE_RATE + taxRate;
        const estimatedProceeds = hasPrice ? marketValue * (1 - sellCostRate) : marketValue;
        const pnl = hasPrice ? estimatedProceeds - investmentCost : 0;
        const pnlRate = investmentCost > 0 ? (pnl / investmentCost) * 100 : 0;
        const breakevenPrice = h.avgCost / (1 - sellCostRate);
        return { price, investmentCost, marketValue, estimatedProceeds, pnl, pnlRate, breakevenPrice, hasPrice };
    }

    const pnl = hasPrice ? (price - h.avgCost) * h.shares : 0;
    const pnlRate = investmentCost > 0 ? (pnl / investmentCost) * 100 : 0;
    return { price, investmentCost, marketValue, estimatedProceeds: marketValue, pnl, pnlRate, breakevenPrice: null as number | null, hasPrice };
}

export default function AssetsPage() {
    const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
    const [snapshots, setSnapshots] = useState<NetWorthSnapshotView[]>([]);
    const [holdings, setHoldings] = useState<HoldingView[]>([]);
    const [loans, setLoans] = useState<LoanView[]>([]);
    const [cashAccount, setCashAccount] = useState<CashAccountView | null>(null);
    const [travelStats, setTravelStats] = useState<TravelStats | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [travelBudgetInput, setTravelBudgetInput] = useState("");
    const [isEditingTravelBudget, setIsEditingTravelBudget] = useState(false);
    const [loading, setLoading] = useState(true);

    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [isCashModalOpen, setIsCashModalOpen] = useState(false);

    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState("");

    // 交易表單 state
    const [txMarket, setTxMarket] = useState<"TW" | "US">("TW");
    const [txTicker, setTxTicker] = useState("");
    const [txName, setTxName] = useState("");
    const [txSide, setTxSide] = useState<"buy" | "sell">("buy");
    const [txShares, setTxShares] = useState("");
    const [txPrice, setTxPrice] = useState("");
    const [txFee, setTxFee] = useState("0");
    const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
    const [txAffectsCash, setTxAffectsCash] = useState(false);

    // 現金存提表單 state
    const [cashType, setCashType] = useState<"deposit" | "withdrawal" | "adjustment">("deposit");
    const [cashAmount, setCashAmount] = useState("");
    const [cashDescription, setCashDescription] = useState("");
    const [cashDate, setCashDate] = useState(new Date().toISOString().slice(0, 10));

    // 快照表單 state
    const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [cashflowRes, snapshotsRes, holdingsRes, loansRes, cashAccountRes, tripsRes, performanceRes] = await Promise.all([
                fetch("/api/dashboard/cashflow?months=12"),
                fetch("/api/net-worth"),
                fetch("/api/holdings"),
                fetch("/api/loans"),
                fetch("/api/cash-account"),
                fetch("/api/trips"),
                fetch("/api/holdings/performance"),
            ]);
            if (cashflowRes.ok) setCashflow(await cashflowRes.json());
            if (snapshotsRes.ok) setSnapshots(await snapshotsRes.json());
            if (holdingsRes.ok) setHoldings(await holdingsRes.json());
            if (loansRes.ok) setLoans(await loansRes.json());
            if (cashAccountRes.ok) setCashAccount(await cashAccountRes.json());
            if (tripsRes.ok) setTravelStats(await tripsRes.json());
            if (performanceRes.ok) setPerformance(await performanceRes.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleOpenTxModal = () => {
        setTxMarket("TW");
        setTxTicker("");
        setTxName("");
        setTxSide("buy");
        setTxShares("");
        setTxPrice("");
        setTxFee("0");
        setTxDate(new Date().toISOString().slice(0, 10));
        setTxAffectsCash(false);
        setIsTxModalOpen(true);
    };

    const handleSaveTx = async () => {
        if (!txTicker || !txShares || !txPrice) return alert("請填寫代號、股數與單價");

        try {
            const res = await fetch("/api/holdings/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    market: txMarket,
                    ticker: txTicker,
                    name: txName || undefined,
                    side: txSide,
                    shares: Number(txShares),
                    pricePerShare: Number(txPrice),
                    fee: Number(txFee) || 0,
                    date: txDate,
                    affectsCash: txAffectsCash,
                }),
            });
            if (res.ok) {
                setIsTxModalOpen(false);
                fetchAll();
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error || "儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleOpenCashModal = () => {
        setCashType("deposit");
        setCashAmount("");
        setCashDescription("");
        setCashDate(new Date().toISOString().slice(0, 10));
        setIsCashModalOpen(true);
    };

    const handleSaveCash = async () => {
        if (!cashAmount) return alert("請填寫金額");
        try {
            const res = await fetch("/api/cash-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: cashType,
                    amount: Number(cashAmount),
                    description: cashDescription || undefined,
                    date: cashDate,
                }),
            });
            if (res.ok) {
                setIsCashModalOpen(false);
                fetchAll();
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error || "儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleOpenSnapshotModal = () => {
        setSnapshotDate(new Date().toISOString().slice(0, 10));
        setIsSnapshotModalOpen(true);
    };

    const handleSaveSnapshot = async () => {
        try {
            const res = await fetch("/api/net-worth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: snapshotDate }),
            });
            if (res.ok) {
                setIsSnapshotModalOpen(false);
                fetchAll();
            } else {
                alert("儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleSaveTravelBudget = async () => {
        const budget = Number(travelBudgetInput);
        if (!budget || budget <= 0) return alert("請輸入正確的預算金額");
        try {
            const res = await fetch("/api/trips", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ budget }),
            });
            if (res.ok) {
                setIsEditingTravelBudget(false);
                fetchAll();
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error || "儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleStartEditPrice = (h: HoldingView) => {
        setEditingPriceId(h.id);
        setEditingPriceValue((h.currentPrice ?? h.avgCost).toString());
    };

    const handleSavePrice = async (id: string) => {
        if (!editingPriceValue) return;
        try {
            const res = await fetch(`/api/holdings/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPrice: Number(editingPriceValue) }),
            });
            if (res.ok) {
                setEditingPriceId(null);
                fetchAll();
            } else {
                const data = await res.json().catch(() => null);
                alert(`更新失敗（${res.status}）：${data?.error || "未知錯誤"}`);
            }
        } catch (error) {
            alert(`更新失敗：${error instanceof Error ? error.message : "網路錯誤"}`);
        }
    };

    const handleDeleteHolding = async (id: string) => {
        if (!confirm("確定要刪除此持股嗎？（不會刪除已產生的現金流紀錄）")) return;
        try {
            await fetch(`/api/holdings/${id}`, { method: "DELETE" });
            fetchAll();
        } catch {
            console.error("Fetch error");
        }
    };

    const cashflowChartData = cashflow.map((c) => ({ month: c.month, total: c.expense, income: c.income, net: c.net }));
    const netWorthChartData = snapshots.map((s) => ({
        date: s.date,
        netWorth: s.netWorth,
        cashBalance: s.cashBalance,
        investmentValueTWD: s.investmentValueTWD,
        loanBalance: s.loanBalance,
    }));
    const activeLoans = loans.filter((l) => l.status === "active");
    const totalLoanBalance = activeLoans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
    const latestSnapshot = snapshots[snapshots.length - 1];
    const currentNetWorth = (cashAccount?.balance ?? latestSnapshot?.cashBalance ?? 0) + (latestSnapshot?.investmentValueTWD ?? 0) - totalLoanBalance;

    // 近 12 月儲蓄率（僅計有資料的月份，避免剛開始記帳的空月份稀釋平均）
    const activeMonths = cashflow.filter((c) => c.income > 0 || c.expense > 0);
    const totalIncome12m = activeMonths.reduce((sum, c) => sum + c.income, 0);
    const totalExpense12m = activeMonths.reduce((sum, c) => sum + c.expense, 0);
    const savingsRate = totalIncome12m > 0 ? ((totalIncome12m - totalExpense12m) / totalIncome12m) * 100 : null;
    const avgMonthlyExpense = activeMonths.length > 0 ? totalExpense12m / activeMonths.length : 0;
    const avgMonthlySavings = activeMonths.length > 0 ? (totalIncome12m - totalExpense12m) / activeMonths.length : 0;

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <h1 className="page-title">📊 資產總覽</h1>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={handleOpenCashModal} style={btnStyle("secondary")}>
                        ＋ 現金存提
                    </button>
                    <button onClick={handleOpenSnapshotModal} style={btnStyle("secondary")}>
                        ＋ 記錄本月快照
                    </button>
                    <button onClick={handleOpenTxModal} style={btnStyle("primary")}>
                        ＋ 新增投資交易
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
                    {(latestSnapshot || cashAccount) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                            <StatTile
                                label="淨資產"
                                value={currentNetWorth}
                                color="#818cf8"
                            />
                            <StatTile label="現金（即時）" value={cashAccount?.balance ?? latestSnapshot?.cashBalance ?? 0} color="#22c55e" />
                            <StatTile label="投資現值" value={latestSnapshot?.investmentValueTWD ?? 0} color="#38bdf8" />
                            <StatTile label="貸款餘額" value={-totalLoanBalance} color="#f43f5e" />
                            <RateTile
                                label="近12月儲蓄率"
                                pct={savingsRate}
                                emptyHint="尚無收入資料"
                                color={savingsRate != null && savingsRate < 0 ? "#f43f5e" : "#f59e0b"}
                            />
                            <RateTile
                                label="投資年化報酬 XIRR"
                                pct={performance?.xirr != null ? performance.xirr * 100 : null}
                                emptyHint={performance?.reason === "insufficient_history" ? "交易未滿 30 天" : "尚無交易紀錄"}
                                color={performance?.xirr != null && performance.xirr < 0 ? "#22c55e" : "#ef4444"}
                            />
                        </div>
                    )}

                    <NetWorthTrendChart data={netWorthChartData} />
                    <MonthlyTrendChart data={cashflowChartData} />

                    {performance?.riskMetrics && (
                        <div className="glass-card" style={{ padding: "24px" }}>
                            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                                📉 投資組合風險指標
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                                依 {performance.riskMetrics.periodsUsed} 期月度淨值快照計算，快照期數越多越準確
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                                <div>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>TWR（時間加權年化報酬）</p>
                                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: performance.riskMetrics.twrPct >= 0 ? "#22c55e" : "#ef4444" }}>
                                        {performance.riskMetrics.twrPct.toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>年化波動度</p>
                                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f59e0b" }}>{performance.riskMetrics.volatilityPct.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Sharpe Ratio</p>
                                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: performance.riskMetrics.sharpe >= 1 ? "#22c55e" : "#818cf8" }}>
                                        {performance.riskMetrics.sharpe.toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>最大回撤</p>
                                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ef4444" }}>{performance.riskMetrics.maxDrawdownPct.toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <FireCalculator
                        avgMonthlyExpense={avgMonthlyExpense}
                        avgMonthlySavings={avgMonthlySavings}
                        currentAssets={currentNetWorth}
                    />

                    <CagrCalculator />

                    <div className="glass-card" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                            📈 持股
                        </h3>
                        {holdings.length === 0 ? (
                            <p style={{ color: "var(--text-muted)" }}>尚未建立任何持股</p>
                        ) : (
                            <div style={{ display: "grid", gap: "12px" }}>
                                {holdings.map((h) => {
                                    const { price, investmentCost, marketValue, pnl, pnlRate, breakevenPrice, hasPrice } = computeHoldingMetrics(h);
                                    const stale = daysSince(h.priceAsOf);
                                    return (
                                        <div key={h.id} className="card" style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <strong>{h.market} {h.ticker} {h.name ? `（${h.name}）` : ""}</strong>
                                                <span style={{ color: pnl >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                                                    {pnl >= 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}
                                                    {hasPrice && <span style={{ fontSize: "0.8rem", marginLeft: "4px" }}>（{pnlRate >= 0 ? "+" : ""}{pnlRate.toFixed(2)}%）</span>}
                                                </span>
                                            </div>
                                            <p className="card-text">股數 {h.shares} ／ 均價 ${h.avgCost.toFixed(2)} ／ 投資成本 ${Math.round(investmentCost).toLocaleString()} ／ 市值 ${Math.round(marketValue).toLocaleString()}</p>
                                            {h.market === "TW" && breakevenPrice != null && (
                                                <p className="card-text">損益平衡價（含手續費+證交稅）約 ${breakevenPrice.toFixed(2)}</p>
                                            )}
                                            {editingPriceId === h.id ? (
                                                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editingPriceValue}
                                                        onChange={(e) => setEditingPriceValue(e.target.value)}
                                                        style={{ ...inputStyle, width: "100px", padding: "4px 8px" }}
                                                    />
                                                    <button onClick={() => handleSavePrice(h.id)} style={{ ...btnStyle("primary"), padding: "4px 10px", fontSize: "0.8rem" }}>儲存</button>
                                                    <button onClick={() => setEditingPriceId(null)} style={{ ...btnStyle("secondary"), padding: "4px 10px", fontSize: "0.8rem" }}>取消</button>
                                                </div>
                                            ) : (
                                                <p className="card-text">
                                                    現價 ${price.toFixed(2)}
                                                    <button onClick={() => handleStartEditPrice(h)} className="card-action-btn" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>✏️ 手動更新現價</button>
                                                </p>
                                            )}
                                            {h.currentPrice == null && <p className="card-date">無最新股價，以成本計算</p>}
                                            {stale != null && stale > 2 && <p className="card-date">⚠️ 價格已 {stale} 天未更新</p>}
                                            <button onClick={() => handleDeleteHolding(h.id)} className="card-action-btn danger" style={{ marginTop: "6px", fontSize: "0.7rem" }}>🗑️ 刪除持股</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="glass-card" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                            🏦 貸款餘額
                        </h3>
                        {activeLoans.length === 0 ? (
                            <p style={{ color: "var(--text-muted)" }}>目前沒有還款中的貸款</p>
                        ) : (
                            <div style={{ display: "grid", gap: "8px" }}>
                                {activeLoans.map((l) => (
                                    <p key={l.id} className="card-text">{l.name}：剩餘 ${l.remainingPrincipal.toLocaleString()} / ${l.principal.toLocaleString()}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="glass-card" style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                ✈️ {travelStats?.year ?? new Date().getFullYear()} 年度旅遊
                            </h3>
                            {isEditingTravelBudget ? (
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <input
                                        type="number"
                                        placeholder="年度預算"
                                        value={travelBudgetInput}
                                        onChange={(e) => setTravelBudgetInput(e.target.value)}
                                        style={{ ...inputStyle, width: "120px", padding: "4px 8px" }}
                                    />
                                    <button onClick={handleSaveTravelBudget} style={{ ...btnStyle("primary"), padding: "4px 10px", fontSize: "0.8rem" }}>儲存</button>
                                    <button onClick={() => setIsEditingTravelBudget(false)} style={{ ...btnStyle("secondary"), padding: "4px 10px", fontSize: "0.8rem" }}>取消</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setTravelBudgetInput(travelStats?.budget?.toString() ?? "");
                                        setIsEditingTravelBudget(true);
                                    }}
                                    className="card-action-btn"
                                    style={{ fontSize: "0.75rem" }}
                                >
                                    ✏️ {travelStats?.budget ? "調整年度預算" : "設定年度預算"}
                                </button>
                            )}
                        </div>
                        <p className="card-text">
                            全年旅遊支出 <strong>${(travelStats?.totalTWD ?? 0).toLocaleString()}</strong>
                            {travelStats?.budget != null && (
                                <>
                                    　／　預算 ${travelStats.budget.toLocaleString()}
                                    {travelStats.budget - travelStats.totalTWD >= 0
                                        ? `（剩 $${(travelStats.budget - travelStats.totalTWD).toLocaleString()}）`
                                        : `（已超支 $${(travelStats.totalTWD - travelStats.budget).toLocaleString()}）`}
                                </>
                            )}
                        </p>
                        {travelStats?.budget != null && (
                            <div style={{ height: "8px", borderRadius: "4px", background: "var(--border-color)", overflow: "hidden", margin: "8px 0 12px" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${Math.min(100, (travelStats.totalTWD / travelStats.budget) * 100)}%`,
                                    background: travelStats.totalTWD > travelStats.budget ? "#f43f5e" : travelStats.totalTWD > travelStats.budget * 0.8 ? "#f59e0b" : "#38bdf8",
                                    transition: "width 0.3s",
                                }} />
                            </div>
                        )}
                        {(travelStats?.trips.length ?? 0) === 0 ? (
                            <p style={{ color: "var(--text-muted)" }}>今年還沒有已結束的旅程（LINE 說「出發去日本」開啟、「回國了」結束，會自動記錄）</p>
                        ) : (
                            <div style={{ display: "grid", gap: "8px" }}>
                                {travelStats!.trips.map((t) => (
                                    <p key={t.id} className="card-text">
                                        🧳 {t.destination ?? "未命名旅程"}　{t.startDate.slice(5)} ～ {t.endDate.slice(5)}（{t.days} 天）　${t.totalTWD.toLocaleString()}
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>　平均 ${Math.round(t.totalTWD / t.days).toLocaleString()}/天</span>
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isTxModalOpen && (
                <Modal title="新增投資交易" onCancel={() => setIsTxModalOpen(false)} onSave={handleSaveTx}>
                    <select value={txMarket} onChange={(e) => setTxMarket(e.target.value as "TW" | "US")} style={inputStyle}>
                        <option value="TW">台股/台灣ETF</option>
                        <option value="US">美股/美國ETF</option>
                    </select>
                    <input type="text" placeholder="代號 (例如 2330 或 AAPL)" value={txTicker} onChange={(e) => setTxTicker(e.target.value)} style={inputStyle} />
                    <input type="text" placeholder="名稱（選填）" value={txName} onChange={(e) => setTxName(e.target.value)} style={inputStyle} />
                    <select value={txSide} onChange={(e) => setTxSide(e.target.value as "buy" | "sell")} style={inputStyle}>
                        <option value="buy">買入</option>
                        <option value="sell">賣出</option>
                    </select>
                    <input type="number" placeholder="股數" value={txShares} onChange={(e) => setTxShares(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="單價" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="手續費" value={txFee} onChange={(e) => setTxFee(e.target.value)} style={inputStyle} />
                    <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} style={inputStyle} />
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "0.875rem" }}>
                        <input type="checkbox" checked={txAffectsCash} onChange={(e) => setTxAffectsCash(e.target.checked)} />
                        這是「今天」實際發生的新交易，同時從現金餘額{txSide === "buy" ? "扣款" : "入帳"}（若是補登已持有的舊部位、或現金早已在其他地方入帳過，請勿勾選）
                    </label>
                </Modal>
            )}

            {isCashModalOpen && (
                <Modal title="現金存提" onCancel={() => setIsCashModalOpen(false)} onSave={handleSaveCash}>
                    <select value={cashType} onChange={(e) => setCashType(e.target.value as "deposit" | "withdrawal" | "adjustment")} style={inputStyle}>
                        <option value="deposit">存入（如薪水入帳）</option>
                        <option value="withdrawal">提出</option>
                        <option value="adjustment">校正為指定餘額（如第一次設定目前餘額）</option>
                    </select>
                    <input
                        type="number"
                        placeholder={cashType === "adjustment" ? "校正後的餘額" : "金額"}
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        style={inputStyle}
                    />
                    <input type="text" placeholder="備註（選填）" value={cashDescription} onChange={(e) => setCashDescription(e.target.value)} style={inputStyle} />
                    <input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} style={inputStyle} />
                    <p className="card-date">目前現金餘額：${(cashAccount?.balance ?? 0).toLocaleString()}</p>
                </Modal>
            )}

            {isSnapshotModalOpen && (
                <Modal title="記錄本月淨資產快照" onCancel={() => setIsSnapshotModalOpen(false)} onSave={handleSaveSnapshot}>
                    <input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} style={inputStyle} />
                    <p className="card-date">現金（${(cashAccount?.balance ?? 0).toLocaleString()}）、投資現值與貸款餘額系統會自動代入，不需手動輸入</p>
                </Modal>
            )}
        </div>
    );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="glass-card" style={{ padding: "16px" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</p>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value < 0 ? "-" : ""}${Math.abs(Math.round(value)).toLocaleString()}</p>
        </div>
    );
}

function RateTile({ label, pct, emptyHint, color }: { label: string; pct: number | null; emptyHint: string; color: string }) {
    return (
        <div className="glass-card" style={{ padding: "16px" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</p>
            {pct == null ? (
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{emptyHint}</p>
            ) : (
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</p>
            )}
        </div>
    );
}

function Modal({ title, onCancel, onSave, children }: { title: string; onCancel: () => void; onSave: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div style={{
                background: "var(--card-bg)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "400px",
                boxShadow: "0 8px 32px var(--shadow-color)"
            }}>
                <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>{title}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {children}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                    <button onClick={onCancel} style={btnStyle("secondary")}>取消</button>
                    <button onClick={onSave} style={btnStyle("primary")}>儲存</button>
                </div>
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = { padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" };

function btnStyle(kind: "primary" | "secondary"): React.CSSProperties {
    return kind === "primary"
        ? { padding: "8px 16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }
        : { padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" };
}
