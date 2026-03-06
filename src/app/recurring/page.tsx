'use client';

import { useState, useEffect } from "react";
import { ALL_TAGS } from "@/utils/constants";
import type { RecurringExpenseView } from "@/models/schema";


export default function RecurringPage() {
    const [entries, setEntries] = useState<RecurringExpenseView[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RecurringExpenseView | null>(null);

    // Form state
    const [amount, setAmount] = useState("");
    const [tag, setTag] = useState("Other");
    const [description, setDescription] = useState("");
    const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
    const [dayOfMonth, setDayOfMonth] = useState("1");
    const [dayOfWeek, setDayOfWeek] = useState("0");
    const [monthOfYear, setMonthOfYear] = useState("1");

    const fetchRecurring = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/recurring");
            if (res.ok) {
                const data = await res.json();
                setEntries(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecurring();
    }, []);

    const handleOpenModal = (item?: RecurringExpenseView) => {
        if (item) {
            setEditingItem(item);
            setAmount(item.amount.toString());
            setTag(item.tag);
            setDescription(item.description);
            setFrequency(item.frequency);
            setDayOfMonth(item.dayOfMonth?.toString() || "1");
            setDayOfWeek(item.dayOfWeek?.toString() || "0");
            setMonthOfYear(item.monthOfYear?.toString() || "1");
        } else {
            setEditingItem(null);
            setAmount("");
            setTag("Other");
            setDescription("");
            setFrequency("monthly");
            setDayOfMonth("1");
            setDayOfWeek("0");
            setMonthOfYear("1");
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!amount || !description) return alert("請填寫金額與說明");

        const data: Partial<RecurringExpenseView> = {
            amount: Number(amount),
            tag,
            description,
            frequency,
            isActive: editingItem ? editingItem.isActive : true,
        };

        if (frequency === "monthly" || frequency === "yearly") {
            data.dayOfMonth = Number(dayOfMonth);
        }
        if (frequency === "weekly") {
            data.dayOfWeek = Number(dayOfWeek);
        }
        if (frequency === "yearly") {
            data.monthOfYear = Number(monthOfYear);
        }

        try {
            const url = editingItem ? `/api/recurring/${editingItem.id}` : "/api/recurring";
            const method = editingItem ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchRecurring();
            } else {
                alert("儲存失敗");
            }
        } catch (err) {
            alert("Error");
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await fetch(`/api/recurring/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus }),
            });
            fetchRecurring();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除此定期支出嗎？")) return;
        try {
            await fetch(`/api/recurring/${id}`, { method: "DELETE" });
            fetchRecurring();
        } catch (err) {
            console.error(err);
        }
    };

    const formatFreq = (e: RecurringExpenseView) => {
        if (e.frequency === "daily") return "每天";
        if (e.frequency === "weekly") {
            const days = ["日", "一", "二", "三", "四", "五", "六"];
            return `每週${days[e.dayOfWeek || 0]}`;
        }
        if (e.frequency === "monthly") return `每月 ${e.dayOfMonth} 日`;
        if (e.frequency === "yearly") return `每年 ${e.monthOfYear} 月 ${e.dayOfMonth} 日`;
        return "";
    };

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className="page-title">🔁 定期/固定收支</h1>
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
                    ＋ 新增定期項目
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <p>尚未建立定期支出</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
                    {entries.map(e => (
                        <div key={e.id} className="card" style={{ opacity: e.isActive ? 1 : 0.6 }}>
                            <div className="card-header">
                                <span className="card-tag">{e.tag}</span>
                                <span className={`card-status ${e.isActive ? 'done' : 'pending'}`}>
                                    {e.isActive ? "🟢 啟用中" : "⚪ 已停用"}
                                </span>
                            </div>
                            <div className="card-body">
                                <h3 className="card-title">{e.description}</h3>
                                <p className="card-text">
                                    <strong>頻率:</strong> {formatFreq(e)}
                                </p>
                                <p className="card-text">
                                    <strong>金額:</strong> <span style={{ color: e.tag === "Income" ? "var(--success)" : "var(--danger)", fontWeight: "bold" }}>${e.amount}</span>
                                </p>
                                {e.lastTriggeredAt && (
                                    <p className="card-date" style={{ marginTop: "4px" }}>
                                        上次觸發: {e.lastTriggeredAt}
                                    </p>
                                )}
                            </div>
                            <div className="card-footer">
                                <div className="card-actions">
                                    <button className="card-action-btn" onClick={() => handleToggleActive(e.id, e.isActive)}>
                                        {e.isActive ? "⏸ 停用" : "▶️ 啟用"}
                                    </button>
                                    <button className="card-action-btn" onClick={() => handleOpenModal(e)}>
                                        ✏️ 編輯
                                    </button>
                                    <button className="card-action-btn danger" onClick={() => handleDelete(e.id)}>
                                        🗑️ 刪除
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
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
                        <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>{editingItem ? "編輯定期項目" : "新增定期項目"}</h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="text"
                                placeholder="項目名稱 (例如: Netflix 訂閱)"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <input
                                type="number"
                                placeholder="金額"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <select
                                value={tag}
                                onChange={e => setTag(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            >
                                {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>

                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as any)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            >
                                <option value="daily">每天</option>
                                <option value="weekly">每週</option>
                                <option value="monthly">每月</option>
                                <option value="yearly">每年</option>
                            </select>

                            {frequency === "weekly" && (
                                <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}>
                                    {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => <option key={i} value={i}>星期{d}</option>)}
                                </select>
                            )}

                            {(frequency === "monthly" || frequency === "yearly") && (
                                <input
                                    type="number"
                                    min="1" max="31"
                                    placeholder="幾號 (1-31)"
                                    value={dayOfMonth}
                                    onChange={e => setDayOfMonth(e.target.value)}
                                    style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                                />
                            )}

                            {frequency === "yearly" && (
                                <input
                                    type="number"
                                    min="1" max="12"
                                    placeholder="幾月 (1-12)"
                                    value={monthOfYear}
                                    onChange={e => setMonthOfYear(e.target.value)}
                                    style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                                />
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
