"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { ALL_TAGS } from "@/utils/constants";
import type { AccountingEntryView } from "@/models/schema";

interface BatchAddEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (entries: AccountingEntryView[]) => void;
}

interface DraftRow {
    date: string;
    amount: string;
    tag: string;
    description: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyRow = (): DraftRow => ({ date: today(), amount: "", tag: "Food", description: "" });

/**
 * 批次新增：一次輸入多列（例如貼上一整個月的明細），單次送出。
 * 台幣、無代墊/付款方式為主，複雜情境（多幣別、代墊）仍請用單筆新增。
 */
export function BatchAddEntryModal({ isOpen, onClose, onCreated }: BatchAddEntryModalProps) {
    const [rows, setRows] = useState<DraftRow[]>([emptyRow(), emptyRow(), emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const updateRow = (index: number, patch: Partial<DraftRow>) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

    const handleSave = async () => {
        const validRows = rows.filter((r) => r.amount.trim() && Number(r.amount) > 0);
        if (validRows.length === 0) {
            setError("請至少填寫一列有效金額");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/accounting/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entries: validRows.map((r) => ({
                        amount: Number(r.amount),
                        tag: r.tag,
                        date: r.date,
                        ...(r.description.trim() ? { description: r.description.trim() } : {}),
                    })),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error ?? `批次新增失敗（HTTP ${res.status}）`);
                return;
            }
            const data = await res.json();
            onCreated(data.entries as AccountingEntryView[]);
            setRows([emptyRow(), emptyRow(), emptyRow()]);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "640px" }}>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Layers size={20} /> 批次新增記帳
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "-8px 0 12px" }}>
                    一次輸入多筆並送出，僅支援台幣、無代墊／指定付款方式；複雜情境請用單筆新增
                </p>
                <div className="modal-body" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {rows.map((row, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 100px 120px 1fr 32px", gap: "8px", alignItems: "center" }}>
                                <input
                                    className="modal-input"
                                    type="date"
                                    value={row.date}
                                    onChange={(e) => updateRow(i, { date: e.target.value })}
                                />
                                <input
                                    className="modal-input"
                                    type="number"
                                    min="0"
                                    placeholder="金額"
                                    value={row.amount}
                                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                                />
                                <select
                                    className="modal-input"
                                    value={row.tag}
                                    onChange={(e) => updateRow(i, { tag: e.target.value })}
                                >
                                    {ALL_TAGS.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <input
                                    className="modal-input"
                                    type="text"
                                    placeholder="說明（選填）"
                                    value={row.description}
                                    onChange={(e) => updateRow(i, { description: e.target.value })}
                                />
                                <button
                                    onClick={() => removeRow(i)}
                                    disabled={rows.length <= 1}
                                    style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: rows.length <= 1 ? "not-allowed" : "pointer", fontSize: "1rem" }}
                                    title="刪除此列"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addRow}
                        style={{ marginTop: "10px", padding: "6px 12px", borderRadius: "6px", border: "1px dashed var(--border-color)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                        ＋ 新增一列
                    </button>
                    {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "8px" }}>{error}</p>}
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={saving}>取消</button>
                    <button className="modal-btn modal-btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? "新增中..." : `新增 ${rows.filter((r) => r.amount.trim() && Number(r.amount) > 0).length} 筆`}
                    </button>
                </div>
            </div>
        </div>
    );
}
