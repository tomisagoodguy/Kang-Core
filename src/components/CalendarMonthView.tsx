"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import type { CalendarEntryView } from "@/models/schema";
import { getCalendarSourceMeta, type CalendarSourceKind } from "@/utils/calendarSource";
import { CalendarCard } from "./CalendarCard";

type ViewMode = "month" | "schedule";
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const LEGEND: { kind: CalendarSourceKind; label: string; color: string }[] = [
    { kind: "todo", label: "待辦事項", color: "var(--success)" },
    { kind: "gcal-primary", label: "Google 日曆", color: "var(--brand-google-blue)" },
    { kind: "gcal-secondary", label: "次要日曆", color: "var(--brand-google-red)" },
    { kind: "task", label: "Google Tasks", color: "var(--brand-google-yellow)" },
];

const MAX_VISIBLE_PER_DAY = 3;

export function CalendarMonthView() {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [entries, setEntries] = useState<CalendarEntryView[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("month");

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        fetch(`/api/calendar/month?year=${currentYear}&month=${currentMonth}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.success) {
                    setEntries(data.entries);
                }
            })
            .catch(err => console.error("Failed to fetch monthly calendar:", err))
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [currentYear, currentMonth]);

    // Days calculation
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)

    // Create an array of days
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    // Mapping entries to days
    const eventsByDay: Record<number, CalendarEntryView[]> = {};
    for (const entry of entries) {
        if (!entry.actionDate) continue;
        const [eY, eM, eD] = entry.actionDate.split("-").map(Number);
        if (eY === currentYear && eM === currentMonth) {
            if (!eventsByDay[eD]) eventsByDay[eD] = [];
            eventsByDay[eD].push(entry);
        }
    }

    const handlePrevMonth = () => {
        setSelectedDay(null);
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        setSelectedDay(null);
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    };

    const isToday = (day: number) =>
        today.getFullYear() === currentYear &&
        (today.getMonth() + 1) === currentMonth &&
        today.getDate() === day;

    const selectedDayEntries = selectedDay ? (eventsByDay[selectedDay] || []) : [];

    // 行程模式：依日期分組並排序，沒有行程的日子不顯示（同 Google 日曆的「行程」檢視）
    const scheduleDays = Object.keys(eventsByDay)
        .map(Number)
        .sort((a, b) => a - b)
        .map(d => ({
            day: d,
            entries: [...eventsByDay[d]].sort((a, b) => (a.actionTime || "").localeCompare(b.actionTime || "")),
        }));

    return (
        <div className="glass-card" style={{ padding: "0", position: "relative" }}>
            {loading && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.15)", backdropFilter: "blur(2px)",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 10,
                }}>
                    <span className="login-spinner" aria-label="載入中" />
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border-glass)" }}>
                <button
                    onClick={handlePrevMonth}
                    className="card-action-btn"
                    aria-label="上個月"
                    style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                    <ChevronLeft size={18} />
                </button>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
                    {currentYear} 年 {currentMonth} 月
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", background: "var(--bg-glass)", borderRadius: "8px", padding: "2px" }} role="group" aria-label="檢視模式">
                        <button
                            onClick={() => setViewMode("month")}
                            aria-pressed={viewMode === "month"}
                            aria-label="月檢視"
                            title="月檢視"
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "32px", height: "32px", borderRadius: "6px", border: "none", cursor: "pointer",
                                background: viewMode === "month" ? "var(--accent)" : "transparent",
                                color: viewMode === "month" ? "#fff" : "var(--text-secondary)",
                                transition: "background 0.15s, color 0.15s",
                            }}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("schedule")}
                            aria-pressed={viewMode === "schedule"}
                            aria-label="行程檢視"
                            title="行程檢視"
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "32px", height: "32px", borderRadius: "6px", border: "none", cursor: "pointer",
                                background: viewMode === "schedule" ? "var(--accent)" : "transparent",
                                color: viewMode === "schedule" ? "#fff" : "var(--text-secondary)",
                                transition: "background 0.15s, color 0.15s",
                            }}
                        >
                            <List size={16} />
                        </button>
                    </div>
                    <button
                        onClick={handleNextMonth}
                        className="card-action-btn"
                        aria-label="下個月"
                        style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* 圖例：說明每種顏色代表的資料來源，避免只靠顏色辨識 */}
            <div style={{
                display: "flex", flexWrap: "wrap", gap: "16px",
                padding: "12px 24px", borderBottom: "1px solid var(--border-glass)",
                fontSize: "0.75rem", color: "var(--text-secondary)",
            }}>
                {LEGEND.map(item => (
                    <span key={item.kind} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color, display: "inline-block" }} />
                        {item.label}
                    </span>
                ))}
            </div>

            {viewMode === "month" ? (
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                width: "100%",
                minWidth: 0,
                gap: "1px",
                background: "var(--border-glass)",
                borderBottom: "1px solid var(--border-glass)"
            }}>
                {WEEKDAY_LABELS.map(day => (
                    <div key={day} style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        background: "var(--bg-secondary)",
                        fontSize: "0.8125rem",
                    }}>
                        {day}
                    </div>
                ))}

                {days.map((day, idx) => {
                    const dayEntries = day ? (eventsByDay[day] || []) : [];
                    const visible = dayEntries.slice(0, MAX_VISIBLE_PER_DAY);
                    const overflowCount = dayEntries.length - visible.length;

                    return (
                        <div
                            key={idx}
                            role={day ? "button" : undefined}
                            tabIndex={day ? 0 : undefined}
                            aria-label={day ? `${currentMonth}月${day}日，${dayEntries.length} 筆行程` : undefined}
                            onClick={() => day && setSelectedDay(day)}
                            onKeyDown={(e) => {
                                if (day && (e.key === "Enter" || e.key === " ")) {
                                    e.preventDefault();
                                    setSelectedDay(day);
                                }
                            }}
                            style={{
                                minHeight: "108px",
                                minWidth: 0,
                                background: "var(--bg-secondary)",
                                padding: "8px",
                                cursor: day ? "pointer" : "default",
                                transition: "background 0.15s",
                                overflow: "hidden",
                            }}
                            onMouseEnter={(e) => { if (day) e.currentTarget.style.background = "var(--bg-glass-hover)"; }}
                            onMouseLeave={(e) => { if (day) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                        >
                            {day && (
                                <>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        width: "26px",
                                        height: "26px",
                                        borderRadius: "50%",
                                        background: isToday(day) ? "var(--accent)" : "transparent",
                                        color: isToday(day) ? "#fff" : "var(--text-primary)",
                                        fontWeight: isToday(day) ? 700 : 400,
                                        fontSize: "0.875rem",
                                        marginBottom: "6px",
                                    }}>
                                        {day}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                                        {visible.map(evt => {
                                            const source = getCalendarSourceMeta(evt);
                                            const isDone = evt.status === "done";
                                            return (
                                                <div key={evt.id} style={{
                                                    fontSize: "0.75rem",
                                                    padding: "3px 6px",
                                                    borderRadius: "4px",
                                                    borderLeft: `3px solid ${source.color}`,
                                                    background: "var(--bg-glass)",
                                                    color: "var(--text-primary)",
                                                    opacity: isDone ? 0.5 : 1,
                                                    textDecoration: isDone ? "line-through" : "none",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    minWidth: 0,
                                                }} title={`[${source.label}] ${evt.title}`}>
                                                    {evt.actionTime ? <strong style={{ color: "var(--text-secondary)" }}>{evt.actionTime} </strong> : ""}
                                                    {evt.title}
                                                </div>
                                            );
                                        })}
                                        {overflowCount > 0 && (
                                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", padding: "0 6px" }}>
                                                +{overflowCount} 更多
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            ) : (
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                {scheduleDays.length === 0 ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "24px 0" }}>
                        這個月沒有行程。
                    </p>
                ) : (
                    scheduleDays.map(({ day, entries: dayEntries }) => (
                        <div key={day}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                <span style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: "32px", height: "32px", borderRadius: "50%",
                                    background: isToday(day) ? "var(--accent)" : "var(--bg-glass)",
                                    color: isToday(day) ? "#fff" : "var(--text-primary)",
                                    fontWeight: 700, fontSize: "0.875rem", flexShrink: 0,
                                }}>
                                    {day}
                                </span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    {currentMonth} 月 {day} 日
                                </span>
                                <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                                    週{WEEKDAY_LABELS[new Date(currentYear, currentMonth - 1, day).getDay()]}
                                </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "40px" }}>
                                {dayEntries.map(entry => (
                                    <CalendarCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            )}

            {selectedDay && (
                <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
                        <h3 className="modal-title">
                            {currentYear} 年 {currentMonth} 月 {selectedDay} 日
                        </h3>
                        {selectedDayEntries.length === 0 ? (
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>這天沒有行程。</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                                {selectedDayEntries.map(entry => (
                                    <CalendarCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setSelectedDay(null)}>關閉</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
