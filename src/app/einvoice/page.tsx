'use client';

import { useState, useEffect, useCallback } from "react";
import { getTagEmoji } from "@/utils/tagEmoji";
import { normalizeMerchant } from "@/utils/merchant";
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

    // 爸媽消費分析：生活共同體視角——member ≠ "me"（含未歸屬）即視為爸媽
    const parentsAnalysis = (() => {
        const rows = records.filter((r) => r.member !== "me");
        const total = rows.reduce((s, r) => s + r.amount, 0);

        const byTag = new Map<string, number>();
        const byMerchant = new Map<string, number>();
        const itemCount = new Map<string, number>();
        for (const r of rows) {
            byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + r.amount);
            const merchant = normalizeMerchant(r.merchantName) || r.merchantName;
            byMerchant.set(merchant, (byMerchant.get(merchant) ?? 0) + r.amount);
            for (const item of (r.description ?? "").split("、").map((s) => s.trim()).filter(Boolean)) {
                itemCount.set(item, (itemCount.get(item) ?? 0) + 1);
            }
        }
        const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
        return {
            count: rows.length,
            total,
            tags: sortDesc(byTag),
            merchants: sortDesc(byMerchant).slice(0, 6),
            items: sortDesc(itemCount).slice(0, 10),
        };
    })();

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

            {/* 爸媽消費分析（生活共同體：非「我」即爸媽，含未歸屬） */}
            {parentsAnalysis.count > 0 && (
                <div className="card" style={{ marginTop: "16px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                        <h3 style={{ fontWeight: 700 }}>👨‍👩 爸媽消費分析</h3>
                        <span style={{ fontSize: "13px", opacity: 0.6 }}>非「我」的發票（含未歸屬）共 {parentsAnalysis.count} 筆</span>
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700, margin: "8px 0 14px" }}>
                        ${parentsAnalysis.total.toLocaleString("zh-TW")}
                        <span style={{ fontSize: "13px", fontWeight: 400, opacity: 0.6, marginLeft: "8px" }}>
                            佔全家 {grandTotal > 0 ? Math.round((parentsAnalysis.total / grandTotal) * 100) : 0}%
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "20px" }}>
                        {/* 分類分布 */}
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, opacity: 0.75, marginBottom: "8px" }}>消費種類</div>
                            {parentsAnalysis.tags.map(([tag, amt]) => (
                                <div key={tag} style={{ marginBottom: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                                        <span>{getTagEmoji(tag)} {tag}</span>
                                        <span style={{ fontWeight: 600 }}>${amt.toLocaleString("zh-TW")}</span>
                                    </div>
                                    <div style={{ height: "5px", background: "var(--border, #eee)", borderRadius: "3px", marginTop: "3px" }}>
                                        <div style={{
                                            height: "100%",
                                            width: `${parentsAnalysis.total > 0 ? Math.max(2, (amt / parentsAnalysis.total) * 100) : 0}%`,
                                            background: "var(--primary)",
                                            borderRadius: "3px",
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 常去商家 */}
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, opacity: 0.75, marginBottom: "8px" }}>常去商家 Top {parentsAnalysis.merchants.length}</div>
                            {parentsAnalysis.merchants.map(([merchant, amt], i) => (
                                <div key={merchant} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0", borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "8px" }}>{i + 1}. {merchant}</span>
                                    <span style={{ fontWeight: 600, flexShrink: 0 }}>${amt.toLocaleString("zh-TW")}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 品項熱點 */}
                    {parentsAnalysis.items.length > 0 && (
                        <div style={{ marginTop: "14px" }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, opacity: 0.75, marginBottom: "8px" }}>常買品項</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {parentsAnalysis.items.map(([item, count]) => (
                                    <span key={item} style={{
                                        fontSize: "12px",
                                        padding: "3px 10px",
                                        borderRadius: "999px",
                                        background: "var(--border, #f0f0f0)",
                                    }}>
                                        {item}{count > 1 ? ` ×${count}` : ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
