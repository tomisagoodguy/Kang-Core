'use client';

import { useState, useEffect } from "react";
import type { HoldingView, LoanView, NetWorthSnapshotView } from "@/models/schema";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { NetWorthTrendChart } from "@/components/charts/NetWorthTrendChart";

interface CashflowMonth {
    month: string;
    income: number;
    expense: number;
    net: number;
}

function daysSince(dateStr?: string): number | null {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function AssetsPage() {
    const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
    const [snapshots, setSnapshots] = useState<NetWorthSnapshotView[]>([]);
    const [holdings, setHoldings] = useState<HoldingView[]>([]);
    const [loans, setLoans] = useState<LoanView[]>([]);
    const [loading, setLoading] = useState(true);

    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);

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
    const [txRecordCashFlow, setTxRecordCashFlow] = useState(true);

    // 快照表單 state
    const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
    const [snapshotCash, setSnapshotCash] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [cashflowRes, snapshotsRes, holdingsRes, loansRes] = await Promise.all([
                fetch("/api/dashboard/cashflow?months=12"),
                fetch("/api/net-worth"),
                fetch("/api/holdings"),
                fetch("/api/loans"),
            ]);
            if (cashflowRes.ok) setCashflow(await cashflowRes.json());
            if (snapshotsRes.ok) setSnapshots(await snapshotsRes.json());
            if (holdingsRes.ok) setHoldings(await holdingsRes.json());
            if (loansRes.ok) setLoans(await loansRes.json());
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
        setTxRecordCashFlow(true);
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
                    recordCashFlow: txSide === "buy" ? txRecordCashFlow : false,
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

    const handleOpenSnapshotModal = () => {
        setSnapshotDate(new Date().toISOString().slice(0, 10));
        setSnapshotCash("");
        setIsSnapshotModalOpen(true);
    };

    const handleSaveSnapshot = async () => {
        if (!snapshotCash) return alert("請填寫目前現金/存款餘額");
        try {
            const res = await fetch("/api/net-worth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: snapshotDate, cashBalance: Number(snapshotCash) }),
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
                alert("更新失敗");
            }
        } catch {
            alert("Error");
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

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <h1 className="page-title">📊 資產總覽</h1>
                <div style={{ display: "flex", gap: "8px" }}>
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
                    {latestSnapshot && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                            <StatTile label="淨資產" value={latestSnapshot.netWorth} color="#818cf8" />
                            <StatTile label="現金" value={latestSnapshot.cashBalance} color="#22c55e" />
                            <StatTile label="投資現值" value={latestSnapshot.investmentValueTWD} color="#38bdf8" />
                            <StatTile label="貸款餘額" value={-totalLoanBalance} color="#f43f5e" />
                        </div>
                    )}

                    <NetWorthTrendChart data={netWorthChartData} />
                    <MonthlyTrendChart data={cashflowChartData} />

                    <div className="glass-card" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                            📈 持股
                        </h3>
                        {holdings.length === 0 ? (
                            <p style={{ color: "var(--text-muted)" }}>尚未建立任何持股</p>
                        ) : (
                            <div style={{ display: "grid", gap: "12px" }}>
                                {holdings.map((h) => {
                                    const price = h.currentPrice ?? h.avgCost;
                                    const marketValue = h.shares * price;
                                    const pnl = h.currentPrice != null ? (h.currentPrice - h.avgCost) * h.shares : 0;
                                    const stale = daysSince(h.priceAsOf);
                                    return (
                                        <div key={h.id} className="card" style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <strong>{h.market} {h.ticker} {h.name ? `（${h.name}）` : ""}</strong>
                                                <span style={{ color: pnl >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                                                    {pnl >= 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="card-text">股數 {h.shares} ／ 均價 ${h.avgCost.toFixed(2)} ／ 市值 ${Math.round(marketValue).toLocaleString()}</p>
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
                    {txSide === "buy" && (
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "0.875rem" }}>
                            <input type="checkbox" checked={txRecordCashFlow} onChange={(e) => setTxRecordCashFlow(e.target.checked)} />
                            同時記一筆 Investment 支出（如果已用 LINE 記過這筆錢，請取消勾選避免重複計算）
                        </label>
                    )}
                </Modal>
            )}

            {isSnapshotModalOpen && (
                <Modal title="記錄本月淨資產快照" onCancel={() => setIsSnapshotModalOpen(false)} onSave={handleSaveSnapshot}>
                    <input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="目前現金/存款餘額" value={snapshotCash} onChange={(e) => setSnapshotCash(e.target.value)} style={inputStyle} />
                    <p className="card-date">投資現值與貸款餘額系統會自動代入，不需手動輸入</p>
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
