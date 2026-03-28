"use client";

import { useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
} from "recharts";

interface WeekdayData {
    day: string;
    avg: number;
    count: number;
}

interface WeekdayChartProps {
    data: WeekdayData[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const avg = payload[0]?.value ?? 0;
    const count = payload[0]?.payload?.count ?? 0;
    return (
        <div style={{
            background: "var(--bg-card, #16161e)",
            border: "1px solid rgba(128,128,128,0.2)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.8rem",
            color: "var(--text-primary)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
            <p style={{ color: "#22c55e" }}>平均支出 ${avg.toLocaleString()}</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: 4 }}>
                共 {count} 天有消費記錄
            </p>
        </div>
    );
}

// 星期顏色：週末用暖色，平日用冷色
const COLORS = ["#f472b6", "#60a5fa", "#60a5fa", "#60a5fa", "#60a5fa", "#fb923c", "#f472b6"];
// Sun, Mon, Tue, Wed, Thu, Fri, Sat

export function WeekdayChart({ data }: WeekdayChartProps) {
    const maxAvg = useMemo(() => Math.max(...data.map(d => d.avg), 1), [data]);

    if (data.every(d => d.count === 0)) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                📊 尚無星期消費資料
            </div>
        );
    }

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        📊 星期消費模式
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        各星期平均支出（含所有歷史資料）
                    </p>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <span style={{ color: "#f59e0b", fontWeight: 600 }}>★</span> 最高消費日
                </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => v >= 10000 ? `${v / 10000}萬` : v >= 1000 ? `${v / 1000}千` : `${v}`}
                        width={40}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                    <Bar dataKey="avg" name="平均支出" radius={[4, 4, 0, 0]} maxBarSize={44}>
                        {data.map((entry, index) => (
                            <Cell
                                key={index}
                                fill={entry.avg === maxAvg ? "#f59e0b" : COLORS[index]}
                                fillOpacity={entry.count === 0 ? 0.2 : 0.85}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
