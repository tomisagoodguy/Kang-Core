"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

interface MonthlyData {
    month: string;
    total: number;
}

interface MonthlyTrendChartProps {
    data: MonthlyData[];
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                📈 尚無趨勢資料
            </div>
        );
    }

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "16px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                📈 月度結餘趨勢
            </h3>
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                        dataKey="month"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "#16161e",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#f3f4f6",
                            fontSize: "0.875rem",
                        }}
                        formatter={(value) => [`${Number(value) < 0 ? '-' : ''}$${Math.abs(Number(value)).toLocaleString()}`, "結餘"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#7c3aed", stroke: "#a78bfa", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#a78bfa" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
