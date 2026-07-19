"use client";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

interface NetWorthPoint {
    date: string;
    netWorth: number;
    cashBalance: number;
    investmentValueTWD: number;
    loanBalance: number;
}

interface NetWorthTrendChartProps {
    data: NetWorthPoint[];
}

interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: NetWorthPoint }>;
    label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
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
            <p style={{ color: "#818cf8", fontWeight: 600 }}>淨資產 ${p.netWorth.toLocaleString()}</p>
            <p style={{ color: "var(--text-muted)", marginTop: 4 }}>現金 ${p.cashBalance.toLocaleString()}</p>
            <p style={{ color: "var(--text-muted)" }}>投資現值 ${p.investmentValueTWD.toLocaleString()}</p>
            <p style={{ color: "var(--text-muted)" }}>貸款餘額 -${p.loanBalance.toLocaleString()}</p>
        </div>
    );
}

export function NetWorthTrendChart({ data }: NetWorthTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                💰 尚無淨資產快照，點擊「記錄本月快照」開始追蹤
            </div>
        );
    }

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
                💰 淨資產走勢
            </h3>
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                        dataKey="date"
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
                            return `${v}`;
                        }}
                        width={48}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 2 }} />
                    <Area
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#818cf8"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#gradNetWorth)"
                        dot={{ r: 4, fill: "#16161e", stroke: "#818cf8", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }}
                        animationDuration={1200}
                        name="淨資產"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
