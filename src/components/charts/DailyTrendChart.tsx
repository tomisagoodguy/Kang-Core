"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

interface DailyData {
    day: string;
    expense: number;
    income: number;
}

interface DailyTrendChartProps {
    data: DailyData[];
    month: string; // "2026-03"
}

function formatTick(v: number): string {
    if (v === 0) return "0";
    if (v >= 10000) return `${v / 10000}萬`;
    if (v >= 1000) return `${v / 1000}千`;
    return `${v}`;
}

function getNiceTicks(maxVal: number, base = 100): number[] {
    // 以 base 為最小單位，最多 7 格
    const step = Math.max(base, Math.ceil(maxVal / 7 / base) * base);
    const count = Math.ceil(maxVal / step);
    return Array.from({ length: count + 1 }, (_, i) => i * step);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const expense = payload.find((p: any) => p.dataKey === "expense")?.value ?? 0;
    const income = payload.find((p: any) => p.dataKey === "income")?.value ?? 0;
    const avg = payload.find((p: any) => p.dataKey === "avg")?.value;
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
            <p style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>{label} 日</p>
            {expense > 0 && <p style={{ color: "#22c55e" }}>支出 ${expense.toLocaleString()}</p>}
            {income > 0 && <p style={{ color: "#f43f5e" }}>收入 ${income.toLocaleString()}</p>}
            {avg != null && <p style={{ color: "#f59e0b", marginTop: 4, fontSize: "0.75rem" }}>7日均 ${Math.round(avg).toLocaleString()}</p>}
        </div>
    );
}

export function DailyTrendChart({ data, month }: DailyTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                📅 尚無每日資料
            </div>
        );
    }

    // 7 日滾動平均（支出）
    const withAvg = data.map((d, i) => {
        const slice = data.slice(Math.max(0, i - 3), i + 4);
        const active = slice.filter(w => w.expense > 0);
        const avg = active.length > 0
            ? active.reduce((s, w) => s + w.expense, 0) / active.length
            : null;
        return { ...d, avg };
    });

    const maxExpense = Math.max(...data.map(d => d.expense), 1);
    const maxIncome = Math.max(...data.map(d => d.income), 1);
    const expenseTicks = getNiceTicks(maxExpense, 100);
    const incomeTicks = getNiceTicks(maxIncome, 1000);

    const [year, mon] = month.split("-");
    const label = `${year} 年 ${parseInt(mon)} 月`;

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        📅 每日收支明細
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {label}・橘線為 7 日平均支出
                    </p>
                </div>
                <div style={{ display: "flex", gap: "14px", fontSize: "0.72rem", color: "var(--text-muted)", alignItems: "center" }}>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#22c55e", marginRight: 4 }} />支出（左）</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#f43f5e", marginRight: 4 }} />收入（右）</span>
                    <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#f59e0b", marginRight: 4, verticalAlign: "middle" }} />7日均</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={withAvg} margin={{ top: 5, right: 48, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval={4}
                    />
                    {/* 左軸：支出（細緻刻度） */}
                    <YAxis
                        yAxisId="expense"
                        orientation="left"
                        tick={{ fill: "#22c55e", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatTick}
                        ticks={expenseTicks}
                        domain={[0, expenseTicks[expenseTicks.length - 1]]}
                        width={44}
                    />
                    {/* 右軸：收入 */}
                    <YAxis
                        yAxisId="income"
                        orientation="right"
                        tick={{ fill: "#f43f5e", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatTick}
                        ticks={incomeTicks}
                        domain={[0, incomeTicks[incomeTicks.length - 1]]}
                        width={44}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                    <Bar yAxisId="expense" dataKey="expense" name="支出" fill="#22c55e" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar yAxisId="income" dataKey="income" name="收入" fill="#f43f5e" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Line
                        yAxisId="expense"
                        dataKey="avg"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 3"
                        connectNulls
                        name="7日均"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
