'use client';

import { useState, useEffect } from "react";

interface Rule {
    id: string;
    keyword: string;
    tag: string;
    subTag?: string;
    hitCount?: number;
    count?: number;           // 舊欄位相容
    confidence?: number;
    source?: "auto" | "manual";
}

const ALL_TAGS = ["Food", "Transport", "Entertainment", "Utilities", "Shopping", "Health", "Education", "Other"];

function getConfidence(rule: Rule): number {
    return rule.confidence ?? 0.8;
}

function ConfidenceBadge({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const isLow = value < 0.7;
    const isMedium = value >= 0.7 && value < 0.85;

    const color = isLow
        ? "#ef4444"
        : isMedium
            ? "#f59e0b"
            : "#10b981";

    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "20px",
            background: `${color}22`,
            border: `1px solid ${color}66`,
            color,
        }}>
            {isLow ? "⚠️" : isMedium ? "🔶" : "✅"} {pct}%
        </span>
    );
}

export default function RulesSettingsPage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ tag: "", subTag: "" });
    const [newRule, setNewRule] = useState({ keyword: "", tag: "Food", subTag: "" });

    const fetchRules = async () => {
        setLoading(true);
        const res = await fetch("/api/rules");
        if (res.ok) {
            const data = await res.json();
            setRules(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleAdd = async () => {
        if (!newRule.keyword) return;
        const res = await fetch("/api/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRule),
        });
        if (res.ok) {
            setNewRule({ keyword: "", tag: "Food", subTag: "" });
            fetchRules();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除此規則嗎？")) return;
        const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
        if (res.ok) fetchRules();
    };

    const handleStartEdit = (rule: Rule) => {
        setEditingId(rule.id);
        setEditForm({ tag: rule.tag, subTag: rule.subTag || "" });
    };

    const handleSaveEdit = async (id: string) => {
        const res = await fetch(`/api/rules/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editForm),
        });
        if (res.ok) {
            setEditingId(null);
            fetchRules();
        }
    };

    const lowConfidenceCount = rules.filter(r => getConfidence(r) < 0.7).length;

    return (
        <div className="page-container">
            <h1 className="page-title">⚙️ 自動分類規則管理</h1>
            <p className="page-description">
                當記帳描述包含關鍵字時，系統將自動套用指定的標籤，節省 AI 配額。
                修改記帳的 Tag 會立即更新對應規則。
            </p>

            {lowConfidenceCount > 0 && (
                <div style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#ef4444",
                    fontSize: "0.875rem",
                }}>
                    ⚠️ 有 <strong>{lowConfidenceCount}</strong> 條規則信心指數偏低（&lt;70%），建議手動確認或刪除。
                </div>
            )}

            {/* 新增規則 */}
            <div className="glass-card" style={{ padding: "20px", marginBottom: "32px" }}>
                <h2 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--accent-light)" }}>新增規則</h2>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <input
                        className="filter-select"
                        style={{ flex: 1, minWidth: "200px", background: "rgba(0,0,0,0.2)", color: "white", padding: "8px 12px" }}
                        placeholder="關鍵字 (例如: 7-11, Uber)"
                        value={newRule.keyword}
                        onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                    <select
                        className="filter-select"
                        value={newRule.tag}
                        onChange={(e) => setNewRule({ ...newRule, tag: e.target.value })}
                    >
                        {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                        className="filter-select"
                        style={{ width: "140px", background: "rgba(0,0,0,0.2)", color: "white", padding: "8px 12px" }}
                        placeholder="子標籤 (選填)"
                        value={newRule.subTag}
                        onChange={(e) => setNewRule({ ...newRule, subTag: e.target.value })}
                    />
                    <button onClick={handleAdd} className="navbar-logout" style={{ background: "var(--accent)", color: "white", padding: "8px 20px" }}>
                        新增
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="login-spinner"></div>
            ) : (
                <div className="accounting-list">
                    {rules.map((rule) => {
                        const conf = getConfidence(rule);
                        const isLow = conf < 0.7;
                        const hitCount = rule.hitCount ?? rule.count ?? 0;

                        return (
                            <div
                                key={rule.id}
                                className="glass-card"
                                style={{
                                    padding: "16px",
                                    marginBottom: "12px",
                                    border: isLow ? "1px solid rgba(239,68,68,0.4)" : undefined,
                                    background: isLow ? "rgba(239,68,68,0.05)" : undefined,
                                }}
                            >
                                {editingId === rule.id ? (
                                    // 編輯模式
                                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                                        <span style={{ fontWeight: 700, fontSize: "1rem", minWidth: "80px" }}>
                                            🔑 {rule.keyword}
                                        </span>
                                        <select
                                            className="filter-select"
                                            value={editForm.tag}
                                            onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                                            style={{ padding: "4px 8px" }}
                                        >
                                            {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <input
                                            className="filter-select"
                                            style={{ width: "120px", background: "rgba(0,0,0,0.2)", color: "white", padding: "4px 8px" }}
                                            placeholder="子標籤"
                                            value={editForm.subTag}
                                            onChange={(e) => setEditForm({ ...editForm, subTag: e.target.value })}
                                        />
                                        <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                                            <button
                                                onClick={() => handleSaveEdit(rule.id)}
                                                style={{ padding: "4px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                                            >
                                                儲存
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                style={{ padding: "4px 14px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer" }}
                                            >
                                                取消
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // 展示模式
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                        <div>
                                            <span style={{ fontSize: "1.05rem", fontWeight: "700", marginRight: "12px" }}>
                                                {rule.keyword}
                                            </span>
                                            <span className="tag-badge" style={{ verticalAlign: "middle" }}>{rule.tag}</span>
                                            {rule.subTag && (
                                                <span className="tag-badge" style={{ background: "rgba(124, 58, 237, 0.2)", marginLeft: "8px" }}>{rule.subTag}</span>
                                            )}
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
                                                <ConfidenceBadge value={conf} />
                                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                                    🧮 命中 {hitCount} 次
                                                </span>
                                                {rule.source === "manual" && (
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>👤 手動</span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={() => handleStartEdit(rule)}
                                                className="navbar-logout"
                                                style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)", padding: "4px 12px" }}
                                            >
                                                ✏️ 編輯
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rule.id)}
                                                className="navbar-logout"
                                                style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "4px 12px" }}
                                            >
                                                刪除
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {rules.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
                            目前沒有規則，AI 將會自動學習您的記帳習慣。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
