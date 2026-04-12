"use client";

import { useState, useMemo } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    Sector,
} from "recharts";

interface TagData {
    tag: string;
    total: number;
}

interface SubTagData {
    name: string;
    total: number;
    parentTag: string;
}

interface AccountingEntry {
    tag: string;
    subTag?: string;
    amount: number;
    date?: string;
}

interface TagPieChartProps {
    data: TagData[];
    /** 完整帳目列表（可選），傳入後支援子標籤展開 */
    entries?: AccountingEntry[];
    /** 若有傳入，只分析當月資料 */
    currentMonth?: string;
}

const TAG_COLORS: Record<string, string> = {
    Food: "#f59e0b",
    Transport: "#3b82f6",
    Entertainment: "#ec4899",
    Utilities: "#06b6d4",
    Shopping: "#8b5cf6",
    Health: "#10b981",
    Education: "#f97316",
    Insurance: "#64748b",
    Subscription: "#a78bfa",
    Investment: "#38bdf8",
    Income: "#22c55e",
    Other: "#6b7280",
};

// 子標籤用較淺的色調
function lightenColor(hex: string, amount = 40): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
    const b = Math.min(255, (num & 0x0000ff) + amount);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
    return (
        <g>
            <text x={cx} y={cy - 12} textAnchor="middle" fill={fill} fontSize={13} fontWeight={700}>
                {payload.tag || payload.name}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-secondary)" fontSize={11}>
                ${Number(value).toLocaleString()}
            </text>
            <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
                {(percent * 100).toFixed(1)}%
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={outerRadius + 12}
                outerRadius={outerRadius + 16}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
        </g>
    );
}

export function TagPieChart({ data, entries, currentMonth }: TagPieChartProps) {
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [drillTag, setDrillTag] = useState<string | null>(null);
    const [viewType, setViewType] = useState<"expense" | "income">("expense");

    // 根據視圖類型過濾資料
    const filteredData = useMemo(() => {
        if (viewType === "income") {
            return data.filter(d => d.tag === "Income");
        }
        return data.filter(d => d.tag !== "Income");
    }, [data, viewType]);

    // 計算子標籤分佈
    const subTagData = useMemo<SubTagData[]>(() => {
        if (!drillTag || !entries) return [];
        const filteredEntries = currentMonth
            ? entries.filter(e => e.date?.startsWith(currentMonth))
            : entries;

        const map = new Map<string, number>();
        filteredEntries
            .filter(e => e.tag === drillTag)
            .forEach(e => {
                const key = e.subTag || "（未分類）";
                map.set(key, (map.get(key) || 0) + (e.amount || 0));
            });

        return Array.from(map.entries())
            .map(([name, total]) => ({ name, total, parentTag: drillTag }))
            .sort((a, b) => b.total - a.total);
    }, [drillTag, entries, currentMonth]);

    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                🥧 尚無分類資料
            </div>
        );
    }

    const total = (drillTag ? subTagData : filteredData).reduce((sum, d) => sum + d.total, 0);
    const displayData = drillTag ? subTagData : filteredData;
    const parentColor = drillTag ? TAG_COLORS[drillTag] || TAG_COLORS.Other : undefined;

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            {/* 標題列 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {drillTag ? (
                        <>
                            <span style={{ color: parentColor }}>⬤</span> {drillTag} 子標籤分佈
                        </>
                    ) : (
                        `🥧 當月${viewType === "expense" ? "支出" : "收入"}分佈`
                    )}
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    {!drillTag && (
                        <div style={{
                            display: "flex",
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: "6px",
                            padding: "2px",
                            border: "1px solid rgba(255,255,255,0.1)"
                        }}>
                            <button
                                onClick={() => setViewType("expense")}
                                style={{
                                    fontSize: "0.7rem",
                                    padding: "4px 8px",
                                    background: viewType === "expense" ? "rgba(255,255,255,0.1)" : "transparent",
                                    border: "none",
                                    borderRadius: "4px",
                                    color: viewType === "expense" ? "var(--text-primary)" : "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                支出
                            </button>
                            <button
                                onClick={() => setViewType("income")}
                                style={{
                                    fontSize: "0.7rem",
                                    padding: "4px 8px",
                                    background: viewType === "income" ? "rgba(255,255,255,0.1)" : "transparent",
                                    border: "none",
                                    borderRadius: "4px",
                                    color: viewType === "income" ? "var(--text-primary)" : "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                收入
                            </button>
                        </div>
                    )}
                    {drillTag && (
                        <button
                            onClick={() => { setDrillTag(null); setActiveIndex(-1); }}
                            style={{
                                fontSize: "0.78rem",
                                padding: "4px 10px",
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "6px",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                            }}
                        >
                            ← 返回總覽
                        </button>
                    )}
                </div>
            </div>

            {/* 提示（只在頂層且有 entries 時顯示） */}
            {!drillTag && entries && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px", textAlign: "center" }}>
                    點擊扇形可展開子標籤 🔍
                </p>
            )}

            {/* 若鑽取後子標籤為空 */}
            {drillTag && subTagData.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0" }}>
                    此標籤下尚無子標籤資料
                </div>
            )}

            {(!drillTag || subTagData.length > 0) && (
                <div style={{ position: "relative" }}>
                    {activeIndex === -1 && (
                        <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -60%)",
                            textAlign: "center",
                            pointerEvents: "none",
                            zIndex: 1,
                        }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                                {drillTag ?? (viewType === "expense" ? "當月支出" : "當月收入")}
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                                ${total.toLocaleString()}
                            </div>
                        </div>
                    )}
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={displayData}
                            dataKey="total"
                            nameKey={drillTag ? "name" : "tag"}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={2}
                            strokeWidth={0}
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore – recharts Pie does accept activeIndex/activeShape
                            activeIndex={activeIndex === -1 ? undefined : activeIndex}
                            activeShape={renderActiveShape}
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(-1)}
                            onClick={(entry) => {
                                if (!drillTag && entries) {
                                    setDrillTag((entry as unknown as TagData).tag);
                                    setActiveIndex(-1);
                                }
                            }}
                            style={{ cursor: (!drillTag && entries) ? "pointer" : "default", outline: "none" }}
                        >
                            {displayData.map((entry, index) => {
                                const baseColor = drillTag
                                    ? lightenColor(parentColor!, index * 20)
                                    : TAG_COLORS[(entry as TagData).tag] || TAG_COLORS.Other;
                                return <Cell key={`cell-${index}`} fill={baseColor} />;
                            })}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: "#16161e",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                color: "#f3f4f6", // container text color
                                fontSize: "0.875rem",
                            }}
                            itemStyle={{ color: "#f3f4f6" }} // list item text color
                            formatter={(value) => [
                                `$${Number(value).toLocaleString()} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                            ]}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: "0.75rem", color: "#9ca3af" }}
                            formatter={(value) => value}
                        />
                    </PieChart>
                </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
