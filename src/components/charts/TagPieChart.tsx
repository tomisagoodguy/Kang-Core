"use client";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
} from "recharts";

interface TagData {
    tag: string;
    total: number;
}

interface TagPieChartProps {
    data: TagData[];
}

const TAG_COLORS: Record<string, string> = {
    Food: "#f59e0b",
    Transport: "#3b82f6",
    Entertainment: "#ec4899",
    Utilities: "#06b6d4",
    Shopping: "#8b5cf6",
    Health: "#10b981",
    Education: "#f97316",
    Other: "#6b7280",
};

export function TagPieChart({ data }: TagPieChartProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                🥧 尚無分類資料
            </div>
        );
    }

    const total = data.reduce((sum, d) => sum + d.total, 0);

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "16px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                🥧 當月標籤分佈
            </h3>
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="total"
                        nameKey="tag"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        strokeWidth={0}
                    >
                        {data.map((entry) => (
                            <Cell
                                key={entry.tag}
                                fill={TAG_COLORS[entry.tag] || TAG_COLORS.Other}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            background: "#16161e",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#f3f4f6",
                            fontSize: "0.875rem",
                        }}
                        formatter={(value, name) => [
                            `$${Number(value).toLocaleString()} (${((Number(value) / total) * 100).toFixed(1)}%)`,
                            name,
                        ]}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: "0.75rem", color: "#9ca3af" }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
