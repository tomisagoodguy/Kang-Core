"use client";

import { useMemo, useState } from "react";

interface SpendingHeatmapProps {
    /** YYYY-MM-DD -> total spending (expenses only) */
    spendingMap: Record<string, number>;
    weeks?: number;
}

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getColor(amount: number, max: number): string {
    if (amount === 0 || max === 0) return "rgba(128,128,128,0.12)";
    const r = amount / max;
    if (r < 0.2)  return "rgba(74,222,128,0.55)";
    if (r < 0.45) return "rgba(250,204,21,0.7)";
    if (r < 0.75) return "rgba(249,115,22,0.75)";
    return "rgba(239,68,68,0.85)";
}

function fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    const wd = DAY_LABELS[new Date(dateStr).getDay() === 0 ? 6 : new Date(dateStr).getDay() - 1];
    return `${y}/${m}/${d}（週${wd}）`;
}

export function SpendingHeatmap({ spendingMap, weeks = 17 }: SpendingHeatmapProps) {
    const [hovered, setHovered] = useState<{ date: string; amount: number; x: number; y: number } | null>(null);

    const { cells, monthMarkers, maxAmount } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 從最近的週一往前推 (weeks-1) 週
        const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon … 6=Sun
        const start = new Date(today);
        start.setDate(today.getDate() - dayOfWeek - (weeks - 1) * 7);

        const cells: { date: string; amount: number; isToday: boolean; isFuture: boolean }[] = [];
        const monthMarkers: { weekIdx: number; label: string }[] = [];
        let lastMonth = -1;

        for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < 7; d++) {
                const dt = new Date(start);
                dt.setDate(start.getDate() + w * 7 + d);
                const dateStr = dt.toISOString().slice(0, 10);
                const todayStr = today.toISOString().slice(0, 10);

                if (d === 0 && dt.getMonth() !== lastMonth) {
                    monthMarkers.push({ weekIdx: w, label: `${dt.getMonth() + 1}月` });
                    lastMonth = dt.getMonth();
                }

                cells.push({
                    date: dateStr,
                    amount: spendingMap[dateStr] ?? 0,
                    isToday: dateStr === todayStr,
                    isFuture: dateStr > todayStr,
                });
            }
        }

        const maxAmount = Math.max(...Object.values(spendingMap).filter(Boolean), 1);
        return { cells, monthMarkers, maxAmount };
    }, [spendingMap, weeks]);

    // ─── 洞察計算 ──────────────────────────────────────
    const insights = useMemo(() => {
        const entries = Object.entries(spendingMap).filter(([, v]) => v > 0);

        // 月初(1-10) vs 月底(21-31) 各月平均日均支出
        const earlyTotals: number[] = [], lateTotals: number[] = [];
        const earlyCountMap = new Map<string, number>(), lateCountMap = new Map<string, number>();
        entries.forEach(([date, amt]) => {
            const day = parseInt(date.slice(8, 10));
            const ym = date.slice(0, 7);
            if (day <= 10) {
                earlyCountMap.set(ym, (earlyCountMap.get(ym) || 0) + amt);
            } else if (day >= 21) {
                lateCountMap.set(ym, (lateCountMap.get(ym) || 0) + amt);
            }
        });
        earlyCountMap.forEach(v => earlyTotals.push(v));
        lateCountMap.forEach(v => lateTotals.push(v));
        const earlyAvg = earlyTotals.length ? Math.round(earlyTotals.reduce((s, v) => s + v, 0) / earlyTotals.length / 10) : 0;
        const lateAvg = lateTotals.length ? Math.round(lateTotals.reduce((s, v) => s + v, 0) / lateTotals.length / 10) : 0;

        // 週末(六日) vs 平日日均
        const weekdayTotal = [0, 0, 0, 0, 0], weekendTotal = [0, 0];
        const weekdayCount = [0, 0, 0, 0, 0], weekendCount = [0, 0];
        entries.forEach(([date, amt]) => {
            const wd = new Date(date).getDay(); // 0=Sun
            if (wd === 0 || wd === 6) {
                const i = wd === 6 ? 0 : 1;
                weekendTotal[i] += amt; weekendCount[i]++;
            } else {
                weekdayTotal[wd - 1] += amt; weekdayCount[wd - 1]++;
            }
        });
        const wdAvg = weekdayCount.reduce((s, v) => s + v, 0) > 0
            ? Math.round(weekdayTotal.reduce((s, v) => s + v, 0) / weekdayCount.reduce((s, v) => s + v, 0))
            : 0;
        const weAvg = weekendCount.reduce((s, v) => s + v, 0) > 0
            ? Math.round(weekendTotal.reduce((s, v) => s + v, 0) / weekendCount.reduce((s, v) => s + v, 0))
            : 0;
        const weekendRatio = wdAvg > 0 ? (weAvg / wdAvg) : 0;

        // 最近 30 天最大衝動消費日
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentEntries = entries.filter(([date]) => new Date(date) >= thirtyDaysAgo);
        const impulseDay = recentEntries.sort((a, b) => b[1] - a[1])[0];

        // 最花錢的星期幾（日均）
        const wdTotals = [0, 0, 0, 0, 0, 0, 0];
        const wdCounts = [0, 0, 0, 0, 0, 0, 0];
        entries.forEach(([date, amt]) => {
            const wd = (new Date(date).getDay() + 6) % 7; // 0=Mon
            wdTotals[wd] += amt; wdCounts[wd]++;
        });
        const wdAvgs = wdTotals.map((t, i) => wdCounts[i] ? Math.round(t / wdCounts[i]) : 0);
        const peakWd = wdAvgs.indexOf(Math.max(...wdAvgs));
        const peakWdLabel = DAY_LABELS[peakWd];
        const peakWdAmt = wdAvgs[peakWd];

        return { earlyAvg, lateAvg, weekendRatio, weAvg, wdAvg, impulseDay, peakWdLabel, peakWdAmt };
    }, [spendingMap]);

    const CELL = 13, GAP = 3;

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    🗓️ 消費熱力圖
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    過去 {weeks} 週每日支出強度
                </p>
            </div>

            {/* Heatmap grid */}
            <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
                <div style={{ display: "inline-block", minWidth: "fit-content" }}>
                    {/* Month labels row */}
                    <div style={{ display: "grid", gridTemplateColumns: `28px repeat(${weeks}, ${CELL}px)`, gap: `${GAP}px`, marginBottom: "4px" }}>
                        <div />
                        {Array.from({ length: weeks }, (_, w) => {
                            const marker = monthMarkers.find(m => m.weekIdx === w);
                            return (
                                <div key={w} style={{ fontSize: "0.65rem", color: "var(--text-muted)", textAlign: "center" }}>
                                    {marker?.label ?? ""}
                                </div>
                            );
                        })}
                    </div>

                    {/* Day rows */}
                    <div style={{ display: "flex", gap: `${GAP}px`, position: "relative" }}>
                        {/* Day labels */}
                        <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px`, marginRight: "2px" }}>
                            {DAY_LABELS.map((l, i) => (
                                <div key={i} style={{ height: `${CELL}px`, width: "22px", fontSize: "0.62rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                                    {[0, 2, 4, 6].includes(i) ? l : ""}
                                </div>
                            ))}
                        </div>

                        {/* Week columns */}
                        {Array.from({ length: weeks }, (_, w) => (
                            <div key={w} style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
                                {Array.from({ length: 7 }, (_, d) => {
                                    const cell = cells[w * 7 + d];
                                    if (!cell) return <div key={d} style={{ width: CELL, height: CELL }} />;
                                    return (
                                        <div
                                            key={d}
                                            style={{
                                                width: CELL,
                                                height: CELL,
                                                borderRadius: "3px",
                                                background: cell.isFuture ? "transparent" : getColor(cell.amount, maxAmount),
                                                border: cell.isToday ? "1.5px solid rgba(255,255,255,0.6)" : "none",
                                                cursor: cell.amount > 0 ? "pointer" : "default",
                                                boxSizing: "border-box",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (cell.isFuture) return;
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setHovered({ date: cell.date, amount: cell.amount, x: rect.left, y: rect.top });
                                            }}
                                            onMouseLeave={() => setHovered(null)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "10px", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>少</span>
                {["rgba(128,128,128,0.12)", "rgba(74,222,128,0.55)", "rgba(250,204,21,0.7)", "rgba(249,115,22,0.75)", "rgba(239,68,68,0.85)"].map((c, i) => (
                    <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
                ))}
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>多</span>
            </div>

            {/* Tooltip */}
            {hovered && (
                <div style={{
                    position: "fixed",
                    left: hovered.x + 16,
                    top: hovered.y - 48,
                    background: "var(--bg-card, #16161e)",
                    border: "1px solid rgba(128,128,128,0.25)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.78rem",
                    color: "var(--text-primary)",
                    pointerEvents: "none",
                    zIndex: 9999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                }}>
                    <p style={{ fontWeight: 600 }}>{fmtDate(hovered.date)}</p>
                    <p style={{ color: hovered.amount > 0 ? "#f87171" : "var(--text-muted)", marginTop: 2 }}>
                        {hovered.amount > 0 ? `支出 $${hovered.amount.toLocaleString()}` : "無消費記錄"}
                    </p>
                </div>
            )}

            {/* Insights */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(128,128,128,0.1)" }}>
                <div style={{ background: "rgba(128,128,128,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>📅 月初 vs 月底</p>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        前 10 日均 <span style={{ color: insights.earlyAvg > insights.lateAvg ? "#f87171" : "#4ade80" }}>${insights.earlyAvg.toLocaleString()}</span>
                    </p>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        後 10 日均 <span style={{ color: insights.lateAvg > insights.earlyAvg ? "#f87171" : "#4ade80" }}>${insights.lateAvg.toLocaleString()}</span>
                    </p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {insights.earlyAvg > insights.lateAvg ? "月初花比較多 💸" : insights.lateAvg > insights.earlyAvg ? "月底花比較多 😅" : "月初月底差不多"}
                    </p>
                </div>

                <div style={{ background: "rgba(128,128,128,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>🎉 週末消費倍率</p>
                    <p style={{ fontSize: "1.4rem", fontWeight: 700, color: insights.weekendRatio > 1.5 ? "#f87171" : insights.weekendRatio > 1 ? "#fb923c" : "#4ade80" }}>
                        {insights.wdAvg > 0 ? `${insights.weekendRatio.toFixed(1)}x` : "—"}
                    </p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        平日均 ${insights.wdAvg.toLocaleString()} → 週末均 ${insights.weAvg.toLocaleString()}
                    </p>
                </div>

                <div style={{ background: "rgba(128,128,128,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>🔥 最花錢的星期</p>
                    <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b" }}>
                        週{insights.peakWdLabel}
                    </p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        平均 ${insights.peakWdAmt.toLocaleString()} / 天
                    </p>
                </div>

                {insights.impulseDay && (
                    <div style={{ background: "rgba(239,68,68,0.07)", borderRadius: "10px", padding: "12px 14px", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>⚡ 近 30 天衝動消費日</p>
                        <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f87171" }}>
                            {insights.impulseDay[0].slice(5).replace("-", "/")}
                        </p>
                        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f87171" }}>
                            ${Number(insights.impulseDay[1]).toLocaleString()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
