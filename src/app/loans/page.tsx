'use client';

import { useState, useEffect } from "react";
import type { LoanView } from "@/models/schema";
import { computeMonthlyPayment } from "@/utils/loan";

export default function LoansPage() {
    const [loans, setLoans] = useState<LoanView[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LoanView | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [principal, setPrincipal] = useState("");
    const [annualRate, setAnnualRate] = useState("");
    const [termMonths, setTermMonths] = useState("12");
    const [startDate, setStartDate] = useState("");
    const [dayOfMonth, setDayOfMonth] = useState("1");

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/loans");
            if (res.ok) {
                const data = await res.json();
                setLoans(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLoans();
    }, []);

    const handleOpenModal = (item?: LoanView) => {
        if (item) {
            setEditingItem(item);
            setName(item.name);
            setPrincipal(item.principal.toString());
            setAnnualRate(item.annualRate.toString());
            setTermMonths(item.termMonths.toString());
            setStartDate(item.startDate);
            setDayOfMonth(item.dayOfMonth.toString());
        } else {
            setEditingItem(null);
            setName("");
            setPrincipal("");
            setAnnualRate("");
            setTermMonths("12");
            setStartDate(new Date().toISOString().slice(0, 10));
            setDayOfMonth("1");
        }
        setIsModalOpen(true);
    };

    const previewMonthlyPayment = () => {
        const p = Number(principal);
        const r = Number(annualRate);
        const t = Number(termMonths);
        if (!p || !t || Number.isNaN(r)) return null;
        return computeMonthlyPayment(p, r, t);
    };

    const handleSave = async () => {
        if (!name || !principal || !termMonths || !startDate) return alert("請填寫貸款名稱、本金、期數與起始日");

        const data = {
            name,
            principal: Number(principal),
            annualRate: Number(annualRate) || 0,
            termMonths: Number(termMonths),
            startDate,
            dayOfMonth: Number(dayOfMonth),
        };

        try {
            const url = editingItem ? `/api/loans/${editingItem.id}` : "/api/loans";
            const method = editingItem ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchLoans();
            } else {
                alert("儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleSettle = async (id: string) => {
        if (!confirm("確定要將此貸款標記為已結清嗎？")) return;
        try {
            await fetch(`/api/loans/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "settled", remainingPrincipal: 0 }),
            });
            fetchLoans();
        } catch {
            console.error("Fetch error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除此貸款嗎？")) return;
        try {
            await fetch(`/api/loans/${id}`, { method: "DELETE" });
            fetchLoans();
        } catch {
            console.error("Fetch error");
        }
    };

    const preview = previewMonthlyPayment();

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className="page-title">🏦 貸款</h1>
                <button
                    onClick={() => handleOpenModal()}
                    style={{
                        padding: "8px 16px",
                        background: "var(--primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "600",
                        cursor: "pointer"
                    }}
                >
                    ＋ 新增貸款
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : loans.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <p>尚未建立貸款</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
                    {loans.map(l => {
                        const progress = Math.min(100, Math.round((l.paidInstallments / l.termMonths) * 100));
                        return (
                            <div key={l.id} className="card" style={{ opacity: l.status === "active" ? 1 : 0.6 }}>
                                <div className="card-header">
                                    <span className="card-tag">Loan</span>
                                    <span className={`card-status ${l.status === "active" ? 'pending' : 'done'}`}>
                                        {l.status === "active" ? "🟢 還款中" : "✅ 已結清"}
                                    </span>
                                </div>
                                <div className="card-body">
                                    <h3 className="card-title">{l.name}</h3>
                                    <p className="card-text">
                                        <strong>剩餘本金:</strong> ${l.remainingPrincipal.toLocaleString()} / ${l.principal.toLocaleString()}
                                    </p>
                                    <div style={{ width: "100%", height: "8px", borderRadius: "4px", background: "var(--border-color)", marginTop: "4px", marginBottom: "4px" }}>
                                        <div style={{ width: `${progress}%`, height: "100%", borderRadius: "4px", background: "var(--primary)" }} />
                                    </div>
                                    <p className="card-text">
                                        <strong>已繳期數:</strong> {l.paidInstallments} / {l.termMonths}
                                    </p>
                                    <p className="card-text">
                                        <strong>每月應繳:</strong> <span style={{ color: "var(--danger)", fontWeight: "bold" }}>${l.monthlyPayment.toLocaleString()}</span>（年利率 {l.annualRate}%）
                                    </p>
                                    <p className="card-text">
                                        <strong>扣款日:</strong> 每月 {l.dayOfMonth} 日
                                    </p>
                                    {l.lastTriggeredAt && (
                                        <p className="card-date" style={{ marginTop: "4px" }}>
                                            上次扣款: {l.lastTriggeredAt}
                                        </p>
                                    )}
                                </div>
                                <div className="card-footer">
                                    <div className="card-actions">
                                        <button className="card-action-btn" onClick={() => handleOpenModal(l)}>
                                            ✏️ 編輯
                                        </button>
                                        {l.status === "active" && (
                                            <button className="card-action-btn" onClick={() => handleSettle(l.id)}>
                                                ✅ 標記結清
                                            </button>
                                        )}
                                        <button className="card-action-btn danger" onClick={() => handleDelete(l.id)}>
                                            🗑️ 刪除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--card-bg)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "400px",
                        boxShadow: "0 8px 32px var(--shadow-color)"
                    }}>
                        <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>{editingItem ? "編輯貸款" : "新增貸款"}</h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="text"
                                placeholder="貸款名稱 (例如: 信貸-王小明)"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="number"
                                placeholder="本金"
                                value={principal}
                                onChange={e => setPrincipal(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="number"
                                step="0.01"
                                placeholder="年利率 % (例如 3.5)"
                                value={annualRate}
                                onChange={e => setAnnualRate(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="number"
                                min="1"
                                placeholder="總期數 (月)"
                                value={termMonths}
                                onChange={e => setTermMonths(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="number"
                                min="1" max="31"
                                placeholder="每月扣款日 (1-31)"
                                value={dayOfMonth}
                                onChange={e => setDayOfMonth(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            {preview !== null && (
                                <p className="card-text">預估每月應繳: <strong>${preview.toLocaleString()}</strong></p>
                            )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "white", fontWeight: "600", cursor: "pointer" }}
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
