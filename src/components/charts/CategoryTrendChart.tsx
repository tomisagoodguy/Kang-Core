"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { TAG_COLORS } from "@/components/charts/TagPieChart";
import { getTagLabel } from "@/utils/tagEmoji";

export interface TagTrendResponse {
    months: { month: string; tags: Record<string, number>; keywordAmount: number; keywordCount: number }[];
    tagsByTotal: { tag: string; total: number }[];
    subTagsByTotal?: { subTag: string; total: number }[];
    keyword: string | null;
}

export const RANGE_OPTIONS = [6, 12, 24] as const;
const DEFAULT_SELECTED = 3;

export function formatAxisMoney(v: number): string {
    return v >= 10000 ? `${v / 10000}萬` : v >= 1000 ? `${v / 1000}千` : `${v}`;
}

interface TooltipItem {
    dataKey: string;
    value: number;
    color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a, b) => b.value - a.value);
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
            {sorted.map((p) => (
                <p key={p.dataKey} style={{ color: p.color }}>
                    {getTagLabel(p.dataKey)} ${p.value.toLocaleString()}
                </p>
            ))}
        </div>
    );
}

/** 各分類每月支出折線圖（可勾選多個分類比較，資料走後端彙整不受列表 200 筆限制） */
export function CategoryTrendChart() {
    const [range, setRange] = useState<number>(12);
    const [data, setData] = useState<TagTrendResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        fetch(`/api/dashboard/tag-trend?months=${range}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<TagTrendResponse>;
            })
            .then((json) => { if (!cancelled) setData(json); })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗"); });
        return () => { cancelled = true; };
    }, [range]);

    // 首次載入預設勾選支出最高的前幾個分類，之後保留使用者的選擇
    const activeTags = useMemo(
        () => selected ?? (data?.tagsByTotal.slice(0, DEFAULT_SELECTED).map((t) => t.tag) ?? []),
        [selected, data],
    );

    const chartData = useMemo(() => (data?.months ?? []).map((m) => {
        const row: Record<string, string | number> = { month: `${m.month.slice(2, 4)}/${m.month.slice(5)}` };
        activeTags.forEach((t) => { row[t] = m.tags[t] ?? 0; });
        return row;
    }), [data, activeTags]);

    const toggle = (tag: string) => {
        setSelected(activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag]);
    };

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        📈 分類月度趨勢
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        點選下方分類加入比較（金額為你負擔的部分，已換算台幣）
                    </p>
                </div>
                <RangeToggle value={range} onChange={setRange} />
            </div>

            {error && <p style={{ color: "#f87171", fontSize: "0.8rem" }}>⚠️ 趨勢資料載入失敗（{error}）</p>}
            {!error && !data && <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>載入中…</p>}

            {data && (
                <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                        {data.tagsByTotal.map(({ tag, total }) => {
                            const on = activeTags.includes(tag);
                            const color = TAG_COLORS[tag] ?? TAG_COLORS.Other;
                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggle(tag)}
                                    title={`期間合計 $${total.toLocaleString()}`}
                                    style={{
                                        fontSize: "0.72rem",
                                        padding: "4px 10px",
                                        borderRadius: "999px",
                                        border: `1px solid ${on ? color : "rgba(128,128,128,0.3)"}`,
                                        background: on ? `${color}22` : "transparent",
                                        color: on ? color : "var(--text-muted)",
                                        cursor: "pointer",
                                    }}
                                >
                                    {getTagLabel(tag)}
                                </button>
                            );
                        })}
                    </div>
                    {data.tagsByTotal.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "24px 0" }}>📊 期間內沒有支出紀錄</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                                <XAxis dataKey="month" tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatAxisMoney} width={40} />
                                <Tooltip content={<CustomTooltip />} />
                                {activeTags.map((tag) => (
                                    <Line
                                        key={tag}
                                        type="monotone"
                                        dataKey={tag}
                                        stroke={TAG_COLORS[tag] ?? TAG_COLORS.Other}
                                        strokeWidth={2}
                                        dot={{ r: 2.5 }}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </>
            )}
        </div>
    );
}

export function RangeToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div style={{ display: "flex", gap: "4px" }}>
            {RANGE_OPTIONS.map((m) => (
                <button
                    key={m}
                    type="button"
                    onClick={() => onChange(m)}
                    style={{
                        fontSize: "0.7rem",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid rgba(128,128,128,0.25)",
                        background: value === m ? "rgba(128,128,128,0.18)" : "transparent",
                        color: value === m ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer",
                    }}
                >
                    {m} 個月
                </button>
            ))}
        </div>
    );
}
