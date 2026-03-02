'use client';

import { useState, useEffect, useMemo } from "react";
import { AccountingCard } from "@/components/AccountingCard";
import { InsightCard } from "@/components/InsightCard";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { TagPieChart } from "@/components/charts/TagPieChart";

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

interface AccountingEntry {
    id: string;
    amount: number;
    tag: string;
    subTag?: string;
    date: string;
    description?: string;
    originalText?: string;
    imageUrl?: string;
    createdAt?: string;
}

interface CustomTag {
    id: string;
    name: string;
    parentTag: string;
}

export default function AccountingPage() {
    const [entries, setEntries] = useState<AccountingEntry[]>([]);
    const [customTags, setCustomTags] = useState<CustomTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState("all");
    const [selectedSubTag, setSelectedSubTag] = useState("all");
    const [selectedMonth, setSelectedMonth] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [accRes, tagRes] = await Promise.all([
                fetch("/api/accounting?limit=200"),
                fetch("/api/tags")
            ]);

            if (accRes.ok) {
                const data = await accRes.json();
                setEntries(data.entries ?? []);
            }
            if (tagRes.ok) {
                const data = await tagRes.json();
                setCustomTags(data);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const filtered = entries.filter((e) => {
        const tagMatch = selectedTag === "all" || e.tag === selectedTag;
        const subTagMatch = selectedSubTag === "all" || e.subTag === selectedSubTag;
        const monthMatch = selectedMonth === "all" || e.date?.startsWith(selectedMonth);
        return tagMatch && subTagMatch && monthMatch;
    });

    const totalAmount = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 聚合：月度趨勢（近 6 個月）
    const monthlyTrend = useMemo(() => {
        const months = ALL_MONTHS().reverse(); // oldest first
        const map = new Map<string, number>();
        months.forEach((m) => map.set(m, 0));
        entries.forEach((e) => {
            const m = e.date?.slice(0, 7);
            if (m && map.has(m)) {
                map.set(m, (map.get(m) || 0) + (e.amount || 0));
            }
        });
        return months.map((month) => ({
            month: month.slice(5), // "03" from "2026-03"
            total: map.get(month) || 0,
        }));
    }, [entries]);

    // 聚合：當月標籤分佈
    const tagDistribution = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const map = new Map<string, number>();
        entries
            .filter((e) => e.date?.startsWith(currentMonth))
            .forEach((e) => {
                const tag = e.tag || "Other";
                map.set(tag, (map.get(tag) || 0) + (e.amount || 0));
            });
        return Array.from(map.entries())
            .map(([tag, total]) => ({ tag, total }))
            .sort((a, b) => b.total - a.total);
    }, [entries]);

    const handleExportCSV = () => {
        const currentMonth = selectedMonth === "all"
            ? new Date().toISOString().slice(0, 7)
            : selectedMonth;
        window.open(`/api/export/accounting?month=${currentMonth}`);
    };

    return (
        <div className="page-container">
            <h1 className="page-title">💳 記帳記錄</h1>

            <InsightCard />

            {/* 圖表區 */}
            {!loading && entries.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                    <MonthlyTrendChart data={monthlyTrend} />
                    <TagPieChart data={tagDistribution} entries={entries} currentMonth={new Date().toISOString().slice(0, 7)} />
                </div>
            )}

            <div className="filter-bar">
                <select
                    className="filter-select"
                    value={selectedTag}
                    onChange={(e) => {
                        setSelectedTag(e.target.value);
                        setSelectedSubTag("all"); // 重置子標籤
                    }}
                >
                    <option value="all">🏷 全部分類</option>
                    {ALL_TAGS.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={selectedSubTag}
                    onChange={(e) => setSelectedSubTag(e.target.value)}
                    disabled={selectedTag === "all"}
                >
                    <option value="all">🔍 全部子標籤</option>
                    {customTags
                        .filter(t => t.parentTag === selectedTag)
                        .map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))
                    }
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

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        共 {filtered.length} 筆 ·
                    </span>
                    <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: "1.125rem" }}>
                        合計 ${totalAmount.toLocaleString()}
                    </span>
                    <button className="card-action-btn" onClick={handleExportCSV} style={{ opacity: 1, padding: "6px 14px" }}>
                        📥 匯出 CSV
                    </button>
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
