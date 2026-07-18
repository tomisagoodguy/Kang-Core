'use client';

import { useState, useEffect, useMemo } from "react";
import { AccountingRow } from "@/components/AccountingRow";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { TagPieChart } from "@/components/charts/TagPieChart";
import { DailyTrendChart } from "@/components/charts/DailyTrendChart";
import { SpendingHeatmap } from "@/components/charts/SpendingHeatmap";
import { ALL_TAGS } from "@/utils/constants";
import { myExpenseTWD } from "@/utils/currency";
import type { AccountingEntryView, CustomTag, Budget } from "@/models/schema";
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


export default function AccountingPage() {
    const [entries, setEntries] = useState<AccountingEntryView[]>([]);
    const [customTags, setCustomTags] = useState<CustomTag[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState("all");
    const [selectedSubTag, setSelectedSubTag] = useState("all");
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [accRes, tagRes, budgetRes] = await Promise.all([
                fetch("/api/accounting?limit=200"),
                fetch("/api/tags"),
                fetch("/api/budget"),
            ]);

            if (accRes.ok) {
                const data = await accRes.json();
                setEntries(data.entries ?? []);
            }
            if (tagRes.ok) {
                const data = await tagRes.json();
                setCustomTags(data);
            }
            if (budgetRes.ok) {
                const data = await budgetRes.json();
                setBudgets(data.budgets ?? []);
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

    const { totalIncome, totalExpenses } = useMemo(() => {
        return filtered.reduce((acc, e) => {
            const amount = myExpenseTWD(e);
            if (e.tag === "Income") {
                acc.totalIncome += amount;
            } else {
                acc.totalExpenses += amount;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });
    }, [filtered]);

    const netBalance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

    const availableMonths = useMemo(() => {
        const months = new Set(entries.map((e) => e.date?.slice(0, 7)).filter(Boolean));
        return Array.from(months).sort().reverse();
    }, [entries]);

    // 聚合：月度支出趨勢（僅顯示有資料的月份）
    const monthlyTrend = useMemo(() => {
        const expenseMap = new Map<string, number>();
        const incomeMap = new Map<string, number>();

        entries.forEach((e) => {
            const m = e.date?.slice(0, 7);
            if (!m) return;
            const amount = myExpenseTWD(e);
            if (e.tag === "Income") {
                incomeMap.set(m, (incomeMap.get(m) || 0) + amount);
            } else {
                expenseMap.set(m, (expenseMap.get(m) || 0) + amount);
            }
        });

        const months = Array.from(new Set([...expenseMap.keys(), ...incomeMap.keys()])).sort();
        return months
            .slice(-6)
            .map((m) => ({
                month: m.slice(5) + "月",
                fullMonth: m,
                total: expenseMap.get(m) ?? 0,
                income: incomeMap.get(m) ?? 0,
                net: (incomeMap.get(m) ?? 0) - (expenseMap.get(m) ?? 0),
            }));
    }, [entries]);

    // 聚合：當月每日收支
    const dailyTrend = useMemo(() => {
        const targetMonth = selectedMonth === "all" ? new Date().toISOString().slice(0, 7) : selectedMonth;
        const expenseMap = new Map<string, number>();
        const incomeMap = new Map<string, number>();

        entries
            .filter(e => e.date?.startsWith(targetMonth))
            .forEach(e => {
                const day = e.date?.slice(8, 10) ?? "";
                if (!day) return;
                if (e.tag === "Income") {
                    incomeMap.set(day, (incomeMap.get(day) || 0) + myExpenseTWD(e));
                } else {
                    expenseMap.set(day, (expenseMap.get(day) || 0) + myExpenseTWD(e));
                }
            });

        const [y, m] = targetMonth.split("-").map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, "0");
            return { day, expense: expenseMap.get(day) ?? 0, income: incomeMap.get(day) ?? 0 };
        });
    }, [entries, selectedMonth]);

    const dailyTrendMonth = selectedMonth === "all" ? new Date().toISOString().slice(0, 7) : selectedMonth;

    // 聚合：當月標籤分佈
    const tagDistribution = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const map = new Map<string, number>();
        entries
            .filter((e) => e.date?.startsWith(currentMonth))
            .forEach((e) => {
                const tag = e.tag || "Other";
                map.set(tag, (map.get(tag) || 0) + myExpenseTWD(e));
            });
        return Array.from(map.entries())
            .map(([tag, total]) => ({ tag, total }))
            .sort((a, b) => b.total - a.total);
    }, [entries]);

    // 聚合：每日支出 Map（供熱力圖使用）
    const spendingMap = useMemo(() => {
        const map: Record<string, number> = {};
        entries
            .filter(e => e.tag !== "Income" && e.date)
            .forEach(e => {
                map[e.date!] = (map[e.date!] || 0) + myExpenseTWD(e);
            });
        return map;
    }, [entries]);

    // 計算：本月結餘預測（只在選取當月時顯示）
    const forecast = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (selectedMonth !== currentMonth) return null;
        const today = new Date();
        const daysElapsed = today.getDate();
        const [y, m] = currentMonth.split("-").map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const monthExpenses = entries
            .filter(e => e.date?.startsWith(currentMonth) && e.tag !== "Income")
            .reduce((sum, e) => sum + myExpenseTWD(e), 0);
        const monthIncome = entries
            .filter(e => e.date?.startsWith(currentMonth) && e.tag === "Income")
            .reduce((sum, e) => sum + myExpenseTWD(e), 0);
        if (daysElapsed === 0) return null;
        const dailyExpenseAvg = monthExpenses / daysElapsed;
        const projectedExpense = Math.round(dailyExpenseAvg * daysInMonth);
        const projectedBalance = monthIncome - projectedExpense;
        const daysLeft = daysInMonth - daysElapsed;
        return { projectedExpense, projectedBalance, daysLeft, daysInMonth, daysElapsed };
    }, [entries, selectedMonth]);

    // 聚合：本月預算進度
    const budgetProgress = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthExpenses = entries.filter(e => e.date?.startsWith(currentMonth) && e.tag !== "Income");
        const spentMap = monthExpenses.reduce((map, e) => {
            map.set(e.tag, (map.get(e.tag) || 0) + myExpenseTWD(e));
            return map;
        }, new Map<string, number>());
        const totalSpent = monthExpenses.reduce((sum, e) => sum + myExpenseTWD(e), 0);
        return budgets
            .map(b => {
                const spent = b.tag ? (spentMap.get(b.tag) || 0) : totalSpent;
                const pct = b.monthlyLimit > 0 ? Math.min(100, (spent / b.monthlyLimit) * 100) : 0;
                return { id: b.id, tag: b.tag, monthlyLimit: b.monthlyLimit, spent, pct };
            })
            .sort((a, b) => b.pct - a.pct);
    }, [entries, budgets]);

    const handleExportCSV = () => {
        const currentMonth = selectedMonth === "all"
            ? new Date().toISOString().slice(0, 7)
            : selectedMonth;
        window.open(`/api/export/accounting?month=${currentMonth}`);
    };

    // 異常大額支出偵測（IQR 方法，Q3 + 1.5×IQR）
    const outliers = useMemo(() => {
        const expenses = entries.filter(e => e.tag !== "Income" && myExpenseTWD(e) > 0);
        if (expenses.length < 8) return [];

        const sorted = [...expenses].sort((a, b) => myExpenseTWD(a) - myExpenseTWD(b));
        const q1 = myExpenseTWD(sorted[Math.floor(sorted.length * 0.25)] ?? {});
        const q3 = myExpenseTWD(sorted[Math.floor(sorted.length * 0.75)] ?? {});
        const iqr = q3 - q1;
        const threshold = q3 + 1.5 * iqr;

        // 計算各分類平均值（方便顯示「比平常高幾倍」，均以台幣計）
        const tagAvgMap = new Map<string, number>();
        const tagGrouped = expenses.reduce((acc, e) => {
            const t = e.tag ?? "Other";
            acc.set(t, (acc.get(t) ?? []).concat(myExpenseTWD(e)));
            return acc;
        }, new Map<string, number[]>());
        tagGrouped.forEach((amts, tag) => {
            tagAvgMap.set(tag, amts.reduce((s, v) => s + v, 0) / amts.length);
        });

        return expenses
            .filter(e => myExpenseTWD(e) > threshold)
            .sort((a, b) => myExpenseTWD(b) - myExpenseTWD(a))
            .slice(0, 6)
            .map(e => ({
                ...e,
                tagAvg: tagAvgMap.get(e.tag ?? "") ?? 0,
                times: tagAvgMap.get(e.tag ?? "")
                    ? Math.round((myExpenseTWD(e) / tagAvgMap.get(e.tag ?? "")!) * 10) / 10
                    : null,
            }));
    }, [entries]);

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

            {/* 異常大額支出警示 */}
            {!loading && outliers.length > 0 && (
                <div className="glass-card" style={{ padding: "20px 24px", marginBottom: "16px", borderLeft: "3px solid #f87171" }}>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f87171", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        ⚡ 異常大額支出
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>
                            遠高於你的日常水準，是手癢還是必要開銷？
                        </span>
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                        {outliers.map(o => (
                            <div key={o.id} style={{
                                background: "rgba(248,113,113,0.07)",
                                border: "1px solid rgba(248,113,113,0.18)",
                                borderRadius: "10px",
                                padding: "12px 14px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "12px",
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "3px" }}>
                                        {o.date}・{o.tag}{o.subTag ? ` / ${o.subTag}` : ""}
                                    </p>
                                    <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {o.description || o.originalText || "（無描述）"}
                                    </p>
                                    {o.times != null && o.times > 1 && (
                                        <p style={{ fontSize: "0.7rem", color: "#fb923c", marginTop: "3px" }}>
                                            比 {o.tag} 類均值高 {o.times}x（均 ${Math.round(o.tagAvg).toLocaleString()}）
                                        </p>
                                    )}
                                </div>
                                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#f87171", whiteSpace: "nowrap" }}>
                                    ${myExpenseTWD(o).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 圖表區 */}
            {!loading && entries.length > 0 && (
                <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                    <MonthlyTrendChart data={monthlyTrend} />
                    <TagPieChart data={tagDistribution} entries={entries} currentMonth={new Date().toISOString().slice(0, 7)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                    <DailyTrendChart data={dailyTrend} month={dailyTrendMonth} />
                    <SpendingHeatmap spendingMap={spendingMap} />
                </div>
                </>
            )}

            {/* 預算進度條 */}
            {!loading && budgetProgress.length > 0 && (
                <div className="glass-card" style={{ padding: "24px", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                        💰 本月預算進度
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {budgetProgress.map(b => (
                            <div key={b.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "6px" }}>
                                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                        {b.tag ?? "總預算"}
                                    </span>
                                    <span style={{ color: b.pct >= 100 ? "var(--danger)" : b.pct >= 80 ? "#f59e0b" : "var(--text-secondary)" }}>
                                        ${b.spent.toLocaleString()} / ${b.monthlyLimit.toLocaleString()}
                                        <span style={{ marginLeft: "8px", fontWeight: 700 }}>
                                            {Math.round(b.pct)}%
                                        </span>
                                    </span>
                                </div>
                                <div style={{ height: "8px", background: "rgba(128,128,128,0.15)", borderRadius: "4px", overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${b.pct}%`,
                                        borderRadius: "4px",
                                        background: b.pct >= 100 ? "var(--danger)" : b.pct >= 80 ? "#f59e0b" : "#22c55e",
                                        transition: "width 0.6s ease",
                                    }} />
                                </div>
                                {b.pct >= 100 && (
                                    <p style={{ fontSize: "0.72rem", color: "var(--danger)", marginTop: "4px" }}>
                                        ⚠️ 已超出預算 ${(b.spent - b.monthlyLimit).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 收支摘要卡（與週報 Email 同款排版） */}
            {!loading && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                    <div className="glass-card" style={{ padding: "14px 16px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)" }}>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>支出</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                            ${totalExpenses.toLocaleString()}
                        </p>
                    </div>
                    <div className="glass-card" style={{ padding: "14px 16px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>收入</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                            ${totalIncome.toLocaleString()}
                        </p>
                    </div>
                    <div className="glass-card" style={{ padding: "14px 16px" }}>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                            {selectedMonth === new Date().toISOString().slice(0, 7) ? "本月結餘" : selectedMonth === "all" ? "累計結餘" : `${selectedMonth.slice(5)}月結餘`}
                        </p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 700, color: netBalance >= 0 ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                            {netBalance < 0 ? "-" : ""}${Math.abs(netBalance).toLocaleString()}
                        </p>
                        {forecast && (
                            <p style={{ fontSize: "0.68rem", color: forecast.projectedBalance >= 0 ? "var(--text-muted)" : "#f59e0b", marginTop: "2px" }}>
                                📈 預測月底支出 ${forecast.projectedExpense.toLocaleString()}（剩 {forecast.daysLeft} 天）
                            </p>
                        )}
                    </div>
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
                        {availableMonths.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <button className="card-action-btn" onClick={handleExportCSV} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", opacity: 1, padding: "8px 14px", fontWeight: 500 }}>
                    <Download size={16} />
                    匯出 CSV
                </button>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px", maxWidth: "860px" }}>
                            {groupedEntries.map(([date, dailyEntries]) => {
                                const dailyTotal = dailyEntries.reduce((sum, item) => {
                                    return item.tag === "Income" ? sum + myExpenseTWD(item) : sum - myExpenseTWD(item);
                                }, 0);
                                const dateObj = new Date(date + "T00:00:00");
                                const weekday = ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
                                const mmdd = date.slice(5).replace("-", "/");
                                return (
                                    <div key={date} style={{ background: "var(--bg-card)", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-glass)" }}>
                                        {/* Date header */}
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "8px 12px",
                                            background: "var(--bg-glass)",
                                            borderBottom: "1px solid var(--border-glass)",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                                <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{mmdd}</span>
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>週{weekday}</span>
                                            </div>
                                            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: dailyTotal >= 0 ? "var(--success)" : "var(--danger)" }}>
                                                {dailyTotal < 0 ? "-" : "+"}${Math.abs(dailyTotal).toLocaleString()}
                                            </span>
                                        </div>
                                        {/* Entries */}
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            {dailyEntries.map((entry, idx) => (
                                                <div key={entry.id} style={{ borderTop: idx > 0 ? "1px solid var(--border-glass)" : undefined }}>
                                                    <AccountingRow entry={entry} />
                                                </div>
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

