'use client';

import { useState, useEffect, useMemo } from "react";
import { AccountingCard } from "@/components/AccountingCard";
import { InsightCard } from "@/components/InsightCard";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { TagPieChart } from "@/components/charts/TagPieChart";
import { ALL_TAGS } from "@/utils/constants";
import type { AccountingEntryView, CustomTag } from "@/models/schema";
import { AccountingCalendarView } from "@/components/AccountingCalendarView";
import {
    Wallet,
    Tags,
    Filter,
    Calendar,
    Download,
    Loader2,
    Inbox,
    List,
    CalendarDays
} from "lucide-react";

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
    const [entries, setEntries] = useState<AccountingEntryView[]>([]);
    const [customTags, setCustomTags] = useState<CustomTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState("all");
    const [selectedSubTag, setSelectedSubTag] = useState("all");
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

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

    const { totalAmount, totalIncome, totalExpenses } = useMemo(() => {
        return filtered.reduce((acc, e) => {
            const amount = e.amount || 0;
            if (e.tag === "Income") {
                acc.totalIncome += amount;
                acc.totalAmount += amount;
            } else {
                acc.totalExpenses += amount;
                acc.totalAmount -= amount;
            }
            return acc;
        }, { totalAmount: 0, totalIncome: 0, totalExpenses: 0 });
    }, [filtered]);

    // 聚合：月度支出趨勢（僅顯示有資料的月份）
    const monthlyTrend = useMemo(() => {
        const map = new Map<string, number>();
        
        entries.forEach((e) => {
            if (e.tag === "Income") return; // 趨勢圖改為專注於「支出」
            const m = e.date?.slice(0, 7);
            if (m) {
                const amount = e.amount || 0;
                map.set(m, (map.get(m) || 0) + amount);
            }
        });

        // 取得所有有資料的月份並排序
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, total]) => ({
                month: month.slice(5) + "月", 
                fullMonth: month,
                total: total,
            }))
            .slice(-6); // 最多保留最近 6 個有資料的月份
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

    // 對過濾後的結果按照日期進行群組
    const groupedEntries = useMemo(() => {
        const groups: Record<string, AccountingEntryView[]> = {};

        filtered.forEach(entry => {
            const date = entry.date || "未知日期";
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(entry);
        });

        // 依照日期由新到舊排序
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [filtered]);

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Wallet className="text-accent" size={28} />
                記帳記錄
            </h1>

            <InsightCard />

            {/* 圖表區 */}
            {!loading && entries.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                    <MonthlyTrendChart data={monthlyTrend} />
                    <TagPieChart data={tagDistribution} entries={entries} currentMonth={new Date().toISOString().slice(0, 7)} />
                </div>
            )}

            <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1", minWidth: "160px" }}>
                    <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                        <Tags size={16} />
                    </div>
                    <select
                        className="filter-select"
                        value={selectedTag}
                        onChange={(e) => {
                            setSelectedTag(e.target.value);
                            setSelectedSubTag("all"); // 重置子標籤
                        }}
                        style={{ paddingLeft: "36px", width: "100%" }}
                    >
                        <option value="all">全部分類</option>
                        {ALL_TAGS.map((tag) => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>
                </div>

                <div style={{ position: "relative", flex: "1", minWidth: "160px" }}>
                    <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                        <Filter size={16} />
                    </div>
                    <select
                        className="filter-select"
                        value={selectedSubTag}
                        onChange={(e) => setSelectedSubTag(e.target.value)}
                        disabled={selectedTag === "all"}
                        style={{ paddingLeft: "36px", width: "100%" }}
                    >
                        <option value="all">全部子標籤</option>
                        {customTags
                            .filter(t => t.parentTag === selectedTag)
                            .map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                            ))
                        }
                    </select>
                </div>

                <div style={{ position: "relative", flex: "1", minWidth: "160px" }}>
                    <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                        <Calendar size={16} />
                    </div>
                    <select
                        className="filter-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ paddingLeft: "36px", width: "100%" }}
                    >
                        <option value="all">全部月份</option>
                        {ALL_MONTHS().map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                        <div style={{ display: "flex", gap: "12px", fontSize: "0.8125rem" }}>
                            <span style={{ color: "var(--success)" }}>收入: ${totalIncome.toLocaleString()}</span>
                            <span style={{ color: "var(--danger)" }}>支出: ${totalExpenses.toLocaleString()}</span>
                        </div>
                        <span style={{ color: totalAmount >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700, fontSize: "1.125rem" }}>
                            {selectedMonth === new Date().toISOString().slice(0, 7) ? "本月結餘" : selectedMonth === "all" ? "累計結餘" : `${selectedMonth.slice(5)}月結餘`} {totalAmount < 0 ? '-' : ''}${Math.abs(totalAmount).toLocaleString()}
                        </span>
                    </div>
                    <button className="card-action-btn" onClick={handleExportCSV} style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 1, padding: "8px 14px", fontWeight: 500 }}>
                        <Download size={16} />
                        匯出 CSV
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Loader2 className="animate-spin text-accent" size={32} />
                    <p style={{ color: "var(--text-secondary)" }}>載入中...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Inbox className="text-muted opacity-50" size={48} />
                    <p style={{ color: "var(--text-secondary)" }}>沒有符合條件的記帳記錄</p>
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                        <div style={{ display: "flex", background: "var(--bg-glass)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                            <button
                                onClick={() => setViewMode("list")}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 16px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: viewMode === "list" ? "var(--border-glass-hover)" : "transparent",
                                    color: viewMode === "list" ? "var(--text-primary)" : "var(--text-secondary)",
                                    fontWeight: viewMode === "list" ? 600 : 500,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                <List size={16} />
                                列表
                            </button>
                            <button
                                onClick={() => setViewMode("calendar")}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 16px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: viewMode === "calendar" ? "var(--border-glass-hover)" : "transparent",
                                    color: viewMode === "calendar" ? "var(--text-primary)" : "var(--text-secondary)",
                                    fontWeight: viewMode === "calendar" ? 600 : 500,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                <CalendarDays size={16} />
                                日曆
                            </button>
                        </div>
                    </div>

                    {viewMode === "list" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "32px", marginTop: "16px" }}>
                            {groupedEntries.map(([date, dailyEntries]) => {
                                const dailyTotal = dailyEntries.reduce((sum, item) => {
                                    return item.tag === "Income" ? sum + (item.amount || 0) : sum - (item.amount || 0);
                                }, 0);
                                return (
                                    <div key={date}>
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            borderBottom: "1px solid var(--border-glass)",
                                            paddingBottom: "12px",
                                            marginBottom: "16px"
                                        }}>
                                            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                                                <Calendar size={18} className="text-secondary" />
                                                {date}
                                            </h3>
                                            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                日結餘 / <strong style={{ color: dailyTotal >= 0 ? "var(--success)" : "var(--danger)", marginLeft: "4px" }}>{dailyTotal < 0 ? '-' : ''}${Math.abs(dailyTotal).toLocaleString()}</strong>
                                            </span>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                                            {dailyEntries.map((entry) => (
                                                <AccountingCard key={entry.id} entry={entry} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <AccountingCalendarView entries={filtered} currentMonth={selectedMonth} />
                    )}
                </>
            )}
        </div>
    );
}

