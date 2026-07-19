"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ALL_TAGS } from "@/utils/constants";
import { CURRENCIES, PAYMENT_LABELS } from "@/utils/currency";
import type { AccountingEntryView, CustomTag } from "@/models/schema";

interface AddEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (entry: AccountingEntryView) => void;
    customTags?: CustomTag[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function AddEntryModal({ isOpen, onClose, onCreated, customTags = [] }: AddEntryModalProps) {
    const [date, setDate] = useState(today);
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("TWD");
    const [tag, setTag] = useState("Food");
    const [subTag, setSubTag] = useState("");
    const [description, setDescription] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [hasSettlement, setHasSettlement] = useState(false);
    const [paidBy, setPaidBy] = useState<"me" | "other">("other");
    const [counterparty, setCounterparty] = useState("");
    const [myShare, setMyShare] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const subtagOptions = customTags.filter((t) => t.parentTag === tag).map((t) => t.name);

    const handleSave = async () => {
        const amountNum = Number(amount);
        if (!amountNum || amountNum <= 0) {
            setError("金額必須大於 0");
            return;
        }
        if (hasSettlement && !counterparty.trim()) {
            setError("代墊需填對方名稱");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const body: Record<string, unknown> = {
                amount: amountNum,
                tag,
                date,
                currency,
                ...(subTag.trim() ? { subTag: subTag.trim() } : {}),
                ...(description.trim() ? { description: description.trim() } : {}),
                ...(paymentMethod ? { paymentMethod } : {}),
                ...(hasSettlement
                    ? {
                        settlement: {
                            paidBy,
                            counterparty: counterparty.trim(),
                            // 留空＝整筆都算我的
                            myShare: myShare === "" ? amountNum : Number(myShare),
                            settled: false,
                        },
                    }
                    : {}),
            };
            const res = await fetch("/api/accounting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error ?? `新增失敗（HTTP ${res.status}）`);
                return;
            }
            const data = await res.json();
            onCreated(data.entry as AccountingEntryView);
            setAmount("");
            setSubTag("");
            setDescription("");
            setMyShare("");
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Plus size={20} /> 新增記帳
                </h3>
                <div className="modal-body">
                    <div className="modal-field">
                        <label className="modal-label">日期</label>
                        <input className="modal-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "12px" }}>
                        <div className="modal-field">
                            <label className="modal-label">金額（原幣）</label>
                            <input
                                className="modal-input"
                                type="number"
                                min="0"
                                placeholder="當地實際付的數字"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="modal-field">
                            <label className="modal-label">幣別</label>
                            <select className="modal-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                {Object.values(CURRENCIES).map((c) => (
                                    <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {currency !== "TWD" && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "-6px 0 4px" }}>
                            會自動換算台幣；旅遊模式進行中且幣別相同時沿用啟動匯率
                        </p>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="modal-field">
                            <label className="modal-label">分類</label>
                            <select className="modal-input" value={tag} onChange={(e) => { setTag(e.target.value); setSubTag(""); }}>
                                {ALL_TAGS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-field">
                            <label className="modal-label">子分類（選填）</label>
                            <input
                                className="modal-input"
                                list="add-entry-subtags"
                                value={subTag}
                                onChange={(e) => setSubTag(e.target.value)}
                            />
                            <datalist id="add-entry-subtags">
                                {subtagOptions.map((s) => <option key={s} value={s} />)}
                            </datalist>
                        </div>
                    </div>
                    <div className="modal-field">
                        <label className="modal-label">說明</label>
                        <input
                            className="modal-input"
                            type="text"
                            placeholder="例：大阪燒晚餐"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="modal-field">
                        <label className="modal-label">付款方式（選填）</label>
                        <select className="modal-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="">不指定</option>
                            {Object.entries(PAYMENT_LABELS).map(([key, v]) => (
                                <option key={key} value={key}>{v.emoji} {v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-field">
                        <label className="modal-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                            <input type="checkbox" checked={hasSettlement} onChange={(e) => setHasSettlement(e.target.checked)} />
                            🤝 代墊／借貸（刷家人卡、幫朋友付等）
                        </label>
                    </div>
                    {hasSettlement && (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div className="modal-field">
                                    <label className="modal-label">誰先付的</label>
                                    <select className="modal-input" value={paidBy} onChange={(e) => setPaidBy(e.target.value as "me" | "other")}>
                                        <option value="other">對方先付（我欠對方）</option>
                                        <option value="me">我先付（對方欠我）</option>
                                    </select>
                                </div>
                                <div className="modal-field">
                                    <label className="modal-label">對方名稱</label>
                                    <input
                                        className="modal-input"
                                        type="text"
                                        placeholder="例：哥哥"
                                        value={counterparty}
                                        onChange={(e) => setCounterparty(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-field">
                                <label className="modal-label">我的份（原幣）</label>
                                <input
                                    className="modal-input"
                                    type="number"
                                    min="0"
                                    placeholder="留空＝整筆都算我的"
                                    value={myShare}
                                    onChange={(e) => setMyShare(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={saving}>取消</button>
                    <button className="modal-btn modal-btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? "新增中..." : "新增"}
                    </button>
                </div>
            </div>
        </div>
    );
}
