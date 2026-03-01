'use client';

import { useState, useEffect } from "react";
import { AccountingCard } from "@/components/AccountingCard";

const ALL_TAGS = ["Food", "Transport", "Entertainment", "Utilities", "Shopping", "Health", "Education", "Other"];

const ALL_MONTHS = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toISOString().slice(0, 7));
    }
    return months;
};

export default function AccountingPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState("all");
    const [selectedMonth, setSelectedMonth] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const res = await fetch("/api/accounting?limit=100");
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries ?? []);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const filtered = entries.filter((e) => {
        const tagMatch = selectedTag === "all" || e.tag === selectedTag;
        const monthMatch = selectedMonth === "all" || e.date?.startsWith(selectedMonth);
        return tagMatch && monthMatch;
    });

    const totalAmount = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

    return (
        <div className="page-container">
            <h1 className="page-title">💳 記帳記錄</h1>

            <div className="filter-bar">
                <select
                    className="filter-select"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                >
                    <option value="all">🏷 全部分類</option>
                    {ALL_TAGS.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    <option value="all">📅 全部月份</option>
                    {ALL_MONTHS().map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        共 {filtered.length} 筆 ·
                    </span>
                    <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: "1.125rem" }}>
                        合計 ${totalAmount.toLocaleString()}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <p>沒有符合條件的記帳記錄</p>
                </div>
            ) : (
                filtered.map((entry) => (
                    <AccountingCard key={entry.id} entry={entry} />
                ))
            )}
        </div>
    );
}
