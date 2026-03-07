"use client";

import { useState, useEffect } from "react";
import type { CalendarEntryView } from "@/models/schema";

export function CalendarMonthView() {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [entries, setEntries] = useState<CalendarEntryView[]>([]);
    const [loading, setLoading] = useState(true);

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
    const days = [];
    // Padding for prev month
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

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

    // Navigate Month
    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    };

    const isToday = (day: number) => {
        const t = new Date();
        return t.getFullYear() === currentYear &&
            (t.getMonth() + 1) === currentMonth &&
            t.getDate() === day;
    };

    return (
        <div className="glass-card" style={{ padding: "0", position: "relative" }}>
            {loading && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(255,255,255,0.6)", backdropFilter: "blur(2px)",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 10, fontSize: "1.2rem", fontWeight: "bold"
                }}>
                    載入中... 🗓️
                </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <button onClick={handlePrevMonth} className="card-action-btn" style={{ fontSize: "1.2rem" }}>◀</button>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {currentYear} 年 {currentMonth} 月
                </h2>
                <button onClick={handleNextMonth} className="card-action-btn" style={{ fontSize: "1.2rem" }}>▶</button>
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "1px",
                background: "rgba(0,0,0,0.05)",
                borderBottom: "1px solid rgba(0,0,0,0.05)"
            }}>
                {["日", "一", "二", "三", "四", "五", "六"].map(day => (
                    <div key={day} style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        background: "var(--bg-card)",
                        fontSize: "0.875rem"
                    }}>
                        {day}
                    </div>
                ))}

                {days.map((day, idx) => (
                    <div key={idx} style={{
                        minHeight: "120px",
                        background: "var(--bg-card)",
                        padding: "8px",
                    }}>
                        {day && (
                            <>
                                <div style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: isToday(day) ? "var(--accent)" : "transparent",
                                    color: isToday(day) ? "#fff" : "var(--text-primary)",
                                    fontWeight: isToday(day) ? 600 : 400,
                                    marginBottom: "8px"
                                }}>
                                    {day}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    {eventsByDay[day]?.map(evt => {
                                        const isGcal = evt.id.startsWith("gcal-");
                                        const isDone = evt.status === "done";
                                        return (
                                            <div key={evt.id} style={{
                                                fontSize: "0.75rem",
                                                padding: "4px 6px",
                                                borderRadius: "4px",
                                                background: isGcal ? "rgba(66, 133, 244, 0.1)" : "rgba(76, 175, 80, 0.1)",
                                                color: isGcal ? "var(--text-primary)" : "var(--success)",
                                                borderLeft: isGcal ? "3px solid #4285F4" : "3px solid var(--success)",
                                                opacity: isDone ? 0.5 : 1,
                                                textDecoration: isDone ? "line-through" : "none",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }} title={evt.title}>
                                                {evt.actionTime ? <strong style={{ color: "var(--text-secondary)" }}>{evt.actionTime} </strong> : ""}{evt.title}
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
