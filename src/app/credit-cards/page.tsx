'use client';

import { useState, useEffect, useMemo } from "react";
import type { CreditCardView, CreditCardBillView, AccountingEntryView } from "@/models/schema";
import { myExpenseTWD } from "@/utils/currency";

export default function CreditCardsPage() {
    const [cards, setCards] = useState<CreditCardView[]>([]);
    const [bills, setBills] = useState<CreditCardBillView[]>([]);
    const [entries, setEntries] = useState<AccountingEntryView[]>([]);
    const [loading, setLoading] = useState(true);

    // 新增/編輯卡片 Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CreditCardView | null>(null);
    const [name, setName] = useState("");
    const [billingDay, setBillingDay] = useState("5");
    const [dueDay, setDueDay] = useState("25");

    // 繳款 Modal
    const [payTarget, setPayTarget] = useState<CreditCardView | null>(null);
    const [payAmount, setPayAmount] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [cardsRes, billsRes, entriesRes] = await Promise.all([
                fetch("/api/credit-cards"),
                fetch("/api/credit-card-bills"),
                fetch("/api/accounting?limit=1000"),
            ]);
            if (cardsRes.ok) setCards(await cardsRes.json());
            if (billsRes.ok) setBills(await billsRes.json());
            if (entriesRes.ok) {
                const data = await entriesRes.json();
                setEntries(data.entries ?? []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleOpenModal = (item?: CreditCardView) => {
        if (item) {
            setEditingItem(item);
            setName(item.name);
            setBillingDay(String(item.billingDay));
            setDueDay(String(item.dueDay));
        } else {
            setEditingItem(null);
            setName("");
            setBillingDay("5");
            setDueDay("25");
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name || !billingDay || !dueDay) return alert("請填寫卡片名稱、出帳日與繳款日");
        try {
            const url = editingItem ? `/api/credit-cards/${editingItem.id}` : "/api/credit-cards";
            const method = editingItem ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    billingDay: Number(billingDay),
                    dueDay: Number(dueDay),
                }),
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchAll();
            } else {
                alert("儲存失敗");
            }
        } catch {
            alert("Error");
        }
    };

    const handleToggleActive = async (item: CreditCardView) => {
        try {
            await fetch(`/api/credit-cards/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !item.isActive }),
            });
            fetchAll();
        } catch {
            console.error("Fetch error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除此信用卡嗎？已產生的帳單不會一併刪除。")) return;
        try {
            await fetch(`/api/credit-cards/${id}`, { method: "DELETE" });
            fetchAll();
        } catch {
            console.error("Fetch error");
        }
    };

    const handleOpenPayModal = (card: CreditCardView) => {
        setPayTarget(card);
        setPayAmount("");
    };

    const handleSavePay = async () => {
        if (!payTarget || !payAmount) return alert("請填寫繳款金額");
        try {
            const res = await fetch(`/api/credit-cards/${payTarget.id}/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: Number(payAmount) }),
            });
            if (res.ok) {
                setPayTarget(null);
                fetchAll();
            } else {
                alert("繳款失敗");
            }
        } catch {
            alert("Error");
        }
    };

    // 各卡本期（尚未出帳）已刷卡金額：從最近一期帳單的 periodEnd 隔天算起，沒有帳單則從卡片建立日算起
    const currentPeriodSpend = useMemo(() => {
        const map = new Map<string, number>();
        const singleCardId = cards.length === 1 ? cards[0].id : null;

        cards.forEach((card) => {
            const cardBills = bills
                .filter((b) => b.creditCardId === card.id)
                .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
            const periodStart = cardBills[0]
                ? new Date(new Date(cardBills[0].periodEnd).getTime() + 86400000).toISOString().slice(0, 10)
                : (card.createdAt ? card.createdAt.slice(0, 10) : "1970-01-01");

            const spend = entries
                .filter((e) => e.paymentMethod === "credit_card" && e.date >= periodStart)
                .filter((e) => (e.creditCardId ? e.creditCardId === card.id : singleCardId === card.id))
                .reduce((sum, e) => sum + myExpenseTWD(e), 0);
            map.set(card.id, spend);
        });
        return map;
    }, [cards, bills, entries]);

    const billsByCard = useMemo(() => {
        const map = new Map<string, CreditCardBillView[]>();
        bills.forEach((b) => {
            const list = map.get(b.creditCardId) ?? [];
            list.push(b);
            map.set(b.creditCardId, list);
        });
        return map;
    }, [bills]);

    const statusLabel = (status: string) => {
        if (status === "paid") return { text: "✅ 已繳清", color: "var(--success)" };
        if (status === "partial") return { text: "🟡 部分繳款", color: "#f59e0b" };
        return { text: "🔴 未繳", color: "var(--danger)" };
    };

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className="page-title">💳 信用卡帳單</h1>
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
                    ＋ 新增信用卡
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : cards.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">💳</span>
                    <p>尚未設定信用卡</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
                        設定出帳日與繳款日後，記帳時選擇「信用卡」付款方式並綁定此卡，系統會依帳單週期自動彙整、依 FIFO 沖銷你的繳款
                    </p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
                    {cards.map(card => {
                        const cardBills = (billsByCard.get(card.id) ?? []).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
                        const unpaidTotal = cardBills
                            .filter(b => b.status !== "paid")
                            .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);

                        return (
                            <div key={card.id} className="card" style={{ opacity: card.isActive ? 1 : 0.6 }}>
                                <div className="card-header">
                                    <span className="card-tag">出帳 {card.billingDay} 日・繳款 {card.dueDay} 日</span>
                                    <span className={`card-status ${card.isActive ? 'done' : 'pending'}`}>
                                        {card.isActive ? "🟢 使用中" : "⚪ 已停用"}
                                    </span>
                                </div>
                                <div className="card-body">
                                    <h3 className="card-title">{card.name}</h3>
                                    <p className="card-text">
                                        <strong>本期已刷（未出帳）:</strong> ${Math.round(currentPeriodSpend.get(card.id) ?? 0).toLocaleString()}
                                    </p>
                                    {unpaidTotal > 0 && (
                                        <p className="card-text" style={{ color: "var(--danger)" }}>
                                            <strong>待繳總額:</strong> ${Math.round(unpaidTotal).toLocaleString()}
                                        </p>
                                    )}

                                    {cardBills.length > 0 && (
                                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                            {cardBills.slice(0, 6).map(bill => {
                                                const s = statusLabel(bill.status);
                                                return (
                                                    <div key={bill.id} style={{
                                                        display: "flex", justifyContent: "space-between",
                                                        fontSize: "0.78rem", padding: "6px 10px",
                                                        background: "rgba(128,128,128,0.08)", borderRadius: "6px",
                                                    }}>
                                                        <span>{bill.periodStart} ~ {bill.periodEnd}（{bill.dueDate} 前繳）</span>
                                                        <span style={{ color: s.color, fontWeight: 600 }}>
                                                            ${bill.totalAmount.toLocaleString()} {s.text}
                                                            {bill.status === "partial" && ` (已繳$${bill.paidAmount.toLocaleString()})`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="card-footer">
                                    <div className="card-actions">
                                        <button className="card-action-btn" onClick={() => handleOpenPayModal(card)}>
                                            💰 記錄繳款
                                        </button>
                                        <button className="card-action-btn" onClick={() => handleToggleActive(card)}>
                                            {card.isActive ? "⏸ 停用" : "▶️ 啟用"}
                                        </button>
                                        <button className="card-action-btn" onClick={() => handleOpenModal(card)}>
                                            ✏️ 編輯
                                        </button>
                                        <button className="card-action-btn danger" onClick={() => handleDelete(card.id)}>
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
                        <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>{editingItem ? "編輯信用卡" : "新增信用卡"}</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="text"
                                placeholder="卡片名稱（例如：國泰 CUBE）"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>出帳日（1-31）</label>
                                    <input
                                        type="number" min="1" max="31"
                                        value={billingDay}
                                        onChange={e => setBillingDay(e.target.value)}
                                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>繳款日（1-31）</label>
                                    <input
                                        type="number" min="1" max="31"
                                        value={dueDay}
                                        onChange={e => setDueDay(e.target.value)}
                                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                                    />
                                </div>
                            </div>
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

            {payTarget && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--card-bg)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "380px",
                        boxShadow: "0 8px 32px var(--shadow-color)"
                    }}>
                        <h2 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>記錄繳款：{payTarget.name}</h2>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                            繳款金額會依帳單期別由舊到新（FIFO）自動沖銷未繳/部分繳清的帳單
                        </p>
                        <input
                            type="number" min="0"
                            placeholder="本次繳款金額"
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                            <button
                                onClick={() => setPayTarget(null)}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSavePay}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "white", fontWeight: "600", cursor: "pointer" }}
                            >
                                確認繳款
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
