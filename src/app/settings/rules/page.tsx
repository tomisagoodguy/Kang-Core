'use client';

import { useState, useEffect } from "react";

interface Rule {
    id: string;
    keyword: string;
    tag: string;
    subTag?: string;
    count: number;
}

const ALL_TAGS = ["Food", "Transport", "Entertainment", "Utilities", "Shopping", "Health", "Education", "Other"];

export default function RulesSettingsPage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
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

    const handleUpdate = async (id: string, updated: Partial<Rule>) => {
        const res = await fetch(`/api/rules/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
        });
        if (res.ok) {
            setEditingId(null);
            fetchRules();
        }
    };

    return (
        <div className="page-container">
            <h1 className="page-title">⚙️ 自動分類規則管理</h1>
            <p className="page-description">
                當記帳描述包含關鍵字時，系統將自動套用指定的標籤，不再消耗 AI 配額。
            </p>

            <div className="glass-card" style={{ padding: "20px", marginBottom: "32px" }}>
                <h2 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--accent-light)" }}>新增規則</h2>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <input
                        className="filter-select" // Reuse style
                        style={{ flex: 1, minWidth: "200px", background: "rgba(0,0,0,0.2)", color: "white", padding: "8px 12px" }}
                        placeholder="關鍵字 (例如: 7-11, Uber)"
                        value={newRule.keyword}
                        onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
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
                        style={{ width: "120px", background: "rgba(0,0,0,0.2)", color: "white", padding: "8px 12px" }}
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
                    {rules.map((rule) => (
                        <div key={rule.id} className="glass-card" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div>
                                <span style={{ fontSize: "1.1rem", fontWeight: "700", marginRight: "12px" }}>{rule.keyword}</span>
                                <span className="tag-badge" style={{ verticalAlign: "middle" }}>{rule.tag}</span>
                                {rule.subTag && <span className="tag-badge" style={{ background: "rgba(124, 58, 237, 0.2)", marginLeft: "8px" }}>{rule.subTag}</span>}
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                    🧮 已匹配 {rule.count || 0} 次
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => handleDelete(rule.id)} className="navbar-logout" style={{ border: "1px solid #ef4444", color: "#ef4444" }}>
                                    刪除
                                </button>
                            </div>
                        </div>
                    ))}
                    {rules.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)" }}>目前沒有規則，AI 將會自動學習您的記帳習慣。</p>}
                </div>
            )}
        </div>
    );
}
