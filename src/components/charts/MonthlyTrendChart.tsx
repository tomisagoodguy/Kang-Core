"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

interface MonthlyData {
    month: string;
    total: number;
    income: number;
    net?: number;
}

interface MonthlyTrendChartProps {
    data: MonthlyData[];
}

interface TooltipItem {
    dataKey: string;
    value: number;
}

interface TooltipProps {
    active?: boolean;
    payload?: TooltipItem[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
    if (!active || !payload?.length) return null;
    const expense  = payload.find(p => p.dataKey === "total")?.value   ?? 0;
    const income   = payload.find(p => p.dataKey === "income")?.value  ?? 0;
    const surplus  = payload.find(p => p.dataKey === "surplus")?.value ?? 0;
    const deficit  = payload.find(p => p.dataKey === "deficit")?.value ?? 0;
    const net = surplus || deficit; // only one will be non-zero per month
    return (
        <div style={{
            background: "var(--bg-card, #16161e)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
            color: "#f3f4f6",
            fontSize: "0.875rem",
            padding: "12px 16px",
        }}>
            <p style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>{label}</p>
            <p style={{ color: "#22c55e" }}>支出 ${expense.toLocaleString()}</p>
            <p style={{ color: "#f43f5e" }}>收入 ${income.toLocaleString()}</p>
            {(surplus !== 0 || deficit !== 0) && (
                <p style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    color: net >= 0 ? "#818cf8" : "#f87171",
                    fontWeight: 600,
                }}>
                    淨收入 {net >= 0 ? "+" : ""}${net.toLocaleString()}
                </p>
            )}
        </div>
    );
}

/** monthlyTrend 資料需包含 net = income - total */
type ChartRow = MonthlyData & { surplus: number; deficit: number };

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                📈 尚無趨勢資料
            </div>
        );
    }

    const chartData: ChartRow[] = data.map(d => ({
        ...d,
        surplus: (d.net ?? 0) >= 0 ? (d.net ?? 0) : 0,
        deficit: (d.net ?? 0) <  0 ? (d.net ?? 0) : 0,
    }));

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        📉 月度收支趨勢
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        最近六個月的收支波動
                    </p>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem", color: "var(--text-muted)", alignItems: "center" }}>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#22c55e", marginRight: 4 }} />支出</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#f43f5e", marginRight: 4 }} />收入</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#818cf8", marginRight: 4 }} />淨收入</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.13} />
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
                            if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(0)}萬`;
                            if (Math.abs(v) >= 1000)  return `${(v / 1000).toFixed(0)}千`;
                            return `${v}`;
                        }}
                        width={48}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 2 }} />

                    {/* 淨收入柱狀圖：正值藍紫、負值紅 */}
                    <Bar dataKey="surplus" fill="#818cf8" fillOpacity={0.72} maxBarSize={28} radius={[3, 3, 0, 0]} name="淨收入" legendType="none" />
                    <Bar dataKey="deficit" fill="#f87171" fillOpacity={0.72} maxBarSize={28} radius={[0, 0, 3, 3]} name="淨虧損"  legendType="none" />

                    {/* 支出 / 收入面積線 */}
                    <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#gradExpense)"
                        dot={{ r: 4, fill: "#16161e", stroke: "#22c55e", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }}
                        animationDuration={1200}
                        name="支出"
                    />
                    <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#gradIncome)"
                        dot={{ r: 4, fill: "#16161e", stroke: "#f43f5e", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                        animationDuration={1200}
                        name="收入"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
