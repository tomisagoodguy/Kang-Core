'use client';

import { useState, useEffect, useCallback } from "react";
import { getTagEmoji } from "@/utils/tagEmoji";
import type { EinvoiceRecordView } from "@/models/schema";

const MEMBERS = [
    { value: "me", label: "我", color: "var(--primary)" },
    { value: "dad", label: "爸", color: "#e67e22" },
    { value: "mom", label: "媽", color: "#9b59b6" },
] as const;

type MemberValue = typeof MEMBERS[number]["value"];

function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EinvoicePage() {
    const [month, setMonth] = useState(currentMonth());
    const [records, setRecords] = useState<EinvoiceRecordView[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | MemberValue | "unassigned">("all");
    const [savingId, setSavingId] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/einvoice?month=${month}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.records);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleAssign = async (id: string, member: MemberValue | null) => {
        setSavingId(id);
        try {
            const res = await fetch(`/api/einvoice/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member }),
            });
            if (res.ok) {
                setRecords((prev) => prev.map((r) =>
                    r.id === id ? { ...r, member, memberSource: member ? "manual" : undefined } : r
                ));
            } else {
                alert("儲存失敗");
            }
        } catch {
            alert("Error");
        } finally {
            setSavingId(null);
        }
    };

    const summary = (() => {
        const groups: Record<string, { count: number; total: number }> = {
            me: { count: 0, total: 0 },
            dad: { count: 0, total: 0 },
            mom: { count: 0, total: 0 },
            unassigned: { count: 0, total: 0 },
        };
        for (const r of records) {
            const key = r.member ?? "unassigned";
            groups[key].count += 1;
            groups[key].total += r.amount;
        }
        return groups;
    })();

    const grandTotal = records.reduce((s, r) => s + r.amount, 0);

    const filtered = filter === "all"
        ? records
        : records.filter((r) => (filter === "unassigned" ? !r.member : r.member === filter));

    const summaryCards = [
        { key: "me" as const, label: "🙋 我", ...summary.me },
        { key: "dad" as const, label: "👨 爸", ...summary.dad },
        { key: "mom" as const, label: "👩 媽", ...summary.mom },
        { key: "unassigned" as const, label: "❓ 未歸屬", ...summary.unassigned },
    ];

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <h1 className="page-title">🧾 家庭發票</h1>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="card-action-btn" onClick={() => setMonth(shiftMonth(month, -1))}>◀</button>
                    <span style={{ fontWeight: 600, minWidth: "84px", textAlign: "center" }}>{month}</span>
                    <button
                        className="card-action-btn"
                        onClick={() => setMonth(shiftMonth(month, 1))}
                        disabled={month >= currentMonth()}
                    >▶</button>
                </div>
            </div>

            <p className="card-text" style={{ marginTop: "4px", opacity: 0.75 }}>
                全家共用載具的雲端發票，獨立於個人記帳。指定成員一次，同商家之後自動歸屬。
            </p>

            {/* 成員摘要卡 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "16px" }}>
                {summaryCards.map((c) => (
                    <div
                        key={c.key}
                        className="card"
                        onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                        style={{
                            cursor: "pointer",
                            padding: "14px",
                            border: filter === c.key ? "2px solid var(--primary)" : undefined,
                        }}
                    >
                        <div style={{ fontSize: "14px", opacity: 0.8 }}>{c.label}</div>
                        <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                            ${c.total.toLocaleString("zh-TW")}
                        </div>
                        <div style={{ fontSize: "12px", opacity: 0.6 }}>{c.count} 筆</div>
                    </div>
                ))}
            </div>

            <p className="card-text" style={{ marginTop: "12px", fontWeight: 600 }}>
                本月合計 ${grandTotal.toLocaleString("zh-TW")}（{records.length} 筆）
                {filter !== "all" && <button className="card-action-btn" style={{ marginLeft: "12px" }} onClick={() => setFilter("all")}>清除篩選</button>}
            </p>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <p>{records.length === 0 ? "本月尚無電子發票" : "此篩選下沒有資料"}</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                    {filtered.map((r) => (
                        <div key={r.id} className="card" style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {getTagEmoji(r.tag)} {r.merchantName}
                                    </div>
                                    <div style={{ fontSize: "12px", opacity: 0.65, marginTop: "2px" }}>
                                        {r.date} · {r.invoiceNumber}
                                        {r.description && ` · ${r.description}`}
                                        {r.memberSource === "auto-match" && " · 🔗 已對到手動記帳"}
                                        {r.memberSource === "rule" && " · 🤖 規則自動歸屬"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontWeight: 700, color: r.amount < 0 ? "var(--success)" : undefined }}>
                                        ${r.amount.toLocaleString("zh-TW")}
                                    </span>
                                    <div style={{ display: "flex", gap: "4px" }}>
                                        {MEMBERS.map((m) => (
                                            <button
                                                key={m.value}
                                                disabled={savingId === r.id}
                                                onClick={() => handleAssign(r.id, r.member === m.value ? null : m.value)}
                                                style={{
                                                    padding: "4px 10px",
                                                    borderRadius: "999px",
                                                    fontSize: "13px",
                                                    cursor: "pointer",
                                                    border: r.member === m.value ? `2px solid ${m.color}` : "1px solid var(--border, #ccc)",
                                                    background: r.member === m.value ? m.color : "transparent",
                                                    color: r.member === m.value ? "white" : "inherit",
                                                    fontWeight: r.member === m.value ? 700 : 400,
                                                }}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
