'use client';

import React, { useMemo, useState } from "react";
import type { AccountingEntryView } from "@/models/schema";
import { AccountingCard } from "./AccountingCard";

interface AccountingCalendarViewProps {
    entries: AccountingEntryView[];
    currentMonth: string; // YYYY-MM
}

export function AccountingCalendarView({ entries, currentMonth }: AccountingCalendarViewProps) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Ensure we have a valid month string; fallback to current month
    const validMonth = currentMonth === "all" ? new Date().toISOString().slice(0, 7) : currentMonth;
    const [yearStr, monthStr] = validMonth.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-based

    const { days, mappedEntries, totalMonthAmount } = useMemo(() => {
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);

        const startOffset = firstDay.getDay(); // 0 is Sunday
        const daysInMonth = lastDay.getDate();

        // Build mapping of day (1..daysInMonth) -> entries
        const mapping: Record<number, AccountingEntryView[]> = {};
        for (let i = 1; i <= daysInMonth; i++) {
            mapping[i] = [];
        }

        let totalMonth = 0;
        entries.forEach(entry => {
            if (entry.date && entry.date.startsWith(validMonth)) {
                const dayMatch = entry.date.split("-")[2];
                if (dayMatch) {
                    const dayNum = parseInt(dayMatch, 10);
                    if (mapping[dayNum]) {
                        mapping[dayNum].push(entry);
                        totalMonth += (entry.amount || 0);
                    }
                }
            }
        });

        // Create grid array (empty slots before 1st day, then 1..N)
        const grid: (number | null)[] = Array(startOffset).fill(null);
        for (let i = 1; i <= daysInMonth; i++) {
            grid.push(i);
        }

        return { days: grid, mappedEntries: mapping, totalMonthAmount: totalMonth };
    }, [year, monthIndex, entries, validMonth]);

    const handleDayClick = (dayStr: string) => {
        setSelectedDate(selectedDate === dayStr ? null : dayStr);
    };

    const hasSelectionData = selectedDate && mappedEntries[parseInt(selectedDate.split("-")[2], 10)]?.length > 0;
    const selectedEntries = hasSelectionData ? mappedEntries[parseInt(selectedDate.split("-")[2], 10)] : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="glass-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>📅 行事曆 ({validMonth})</h2>
                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--danger)" }}>
                        月合計: ${totalMonthAmount.toLocaleString()}
                    </span>
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "8px",
                    textAlign: "center",
                    fontWeight: 600,
                    marginBottom: "8px",
                    color: "var(--text-secondary)"
                }}>
                    {["日", "一", "二", "三", "四", "五", "六"].map(d => <div key={d}>{d}</div>)}
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "8px"
                }}>
                    {days.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} style={{ padding: "8px", background: "transparent" }}></div>;
                        }

                        const dayStr = `${validMonth}-${day.toString().padStart(2, '0')}`;
                        const dayEntries = mappedEntries[day];
                        const dayTotal = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
                        const isSelected = selectedDate === dayStr;
                        const isToday = dayStr === new Date().toISOString().slice(0, 10);

                        return (
                            <div
                                key={dayStr}
                                onClick={() => handleDayClick(dayStr)}
                                style={{
                                    padding: "8px",
                                    borderRadius: "8px",
                                    background: isSelected ? "var(--primary-light)" : "var(--bg-glass)",
                                    border: isSelected ? "2px solid var(--primary)" : isToday ? "1px solid var(--accent-light)" : "1px solid transparent",
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    minHeight: "80px",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                <span style={{
                                    fontSize: "1rem",
                                    fontWeight: isToday ? 800 : 600,
                                    color: isToday ? "var(--accent-light)" : "inherit"
                                }}>{day}</span>
                                {dayTotal > 0 && (
                                    <span style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 700, marginTop: "auto" }}>
                                        ${dayTotal.toLocaleString()}
                                    </span>
                                )}
                                {dayEntries.length > 0 && (
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                        {dayEntries.length} 筆
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="glass-card" style={{ padding: "20px", background: "rgba(124, 58, 237, 0.05)", borderLeft: "4px solid var(--primary)" }}>
                    <h3 style={{ marginBottom: "16px", fontSize: "1.125rem", fontWeight: 700 }}>
                        📌 {selectedDate} 的記帳 ({selectedEntries.length} 筆)
                    </h3>
                    {selectedEntries.length === 0 ? (
                        <p style={{ color: "var(--text-muted)" }}>這天沒有記帳紀錄。</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                            {selectedEntries.map(entry => (
                                <AccountingCard key={entry.id} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
