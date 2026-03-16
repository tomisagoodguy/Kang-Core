"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    AreaChart,
    Area,
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        📉 月度支出趨勢
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        最近六個月的有記錄支出波動
                    </p>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                        dataKey="month"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => {
                            if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
                            return `$${v}`;
                        }}
                        width={60}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "#16161e",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                            color: "#f3f4f6",
                            fontSize: "0.875rem",
                            padding: "12px",
                        }}
                        itemStyle={{ color: "#f3f4f6", fontWeight: 600 }}
                        cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 2 }}
                        formatter={(value) => [`$${Number(value).toLocaleString()}`, "總支出"]}
                    />
                    <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorExpense)"
                        dot={{ r: 4, fill: "#16161e", stroke: "#f43f5e", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
