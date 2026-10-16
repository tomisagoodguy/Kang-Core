"use client";

import { useEffect, useMemo, useState } from "react";
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
import { DEFAULT_TRACKED_KEYWORD as DEFAULT_KEYWORD } from "@/utils/keywordMatch";
import { RangeToggle, formatAxisMoney, type TagTrendResponse } from "@/components/charts/CategoryTrendChart";

const STORAGE_KEY = "kang-core:keyword-spend";
const HISTORY_KEY = "kang-core:keyword-spend-history";
const HISTORY_LIMIT = 8;
const CUSTOM_OPTION = "__custom__";
const BAR_COLOR = "#ec4899";
const LINE_COLOR = "#f59e0b";

function loadKeyword(): string {
    try {
        return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_KEYWORD;
    } catch {
        return DEFAULT_KEYWORD; // 隱私模式等無法存取 localStorage 時用預設值
    }
}

function loadHistory(): string[] {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
        return [];
    }
}

/** 記住目前與最近查過的關鍵字；寫入失敗只影響下次的選單，不影響查詢 */
function saveKeyword(keyword: string, history: string[]): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, keyword);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
        // 隱私模式等無法寫入 localStorage
    }
}

const fieldStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: "0.85rem",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(128,128,128,0.3)",
    background: "var(--bg-card, transparent)",
    color: "var(--text-primary)",
};

interface TooltipItem {
    dataKey: string;
    value: number;
    payload: { count: number };
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const amount = payload.find((p) => p.dataKey === "amount")?.value ?? 0;
    const cumulative = payload.find((p) => p.dataKey === "cumulative")?.value ?? 0;
    const count = payload[0]?.payload.count ?? 0;
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
            <p style={{ color: BAR_COLOR }}>當月 ${amount.toLocaleString()}（{count} 筆）</p>
            <p style={{ color: LINE_COLOR }}>累計 ${cumulative.toLocaleString()}</p>
        </div>
    );
}

/** 關鍵字主題支出追蹤（跨分類），例如「約會」同時涵蓋 Food 的晚餐與 Entertainment 的電影 */
export function KeywordSpendCard() {
    const [range, setRange] = useState<number>(12);
    const [keyword, setKeyword] = useState<string>(""); // 掛載後才從 localStorage 讀，避免先查預設值再查一次
    const [draft, setDraft] = useState<string>("");
    const [customMode, setCustomMode] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [subTagNames, setSubTagNames] = useState<string[]>([]);
    const [usedSubTags, setUsedSubTags] = useState<string[]>([]); // 記帳實際用過的子分類（依金額排序），切換關鍵字時保留不閃爍
    const [frequentTerms, setFrequentTerms] = useState<string[]>([]); // 記帳內容常出現的詞
    const [data, setData] = useState<TagTrendResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setKeyword(loadKeyword());
        setHistory(loadHistory());
        // 自訂子分類作為選單選項；載入失敗時選單仍有預設與最近查過的關鍵字
        fetch("/api/tags")
            .then(async (res) => (res.ok ? (res.json() as Promise<unknown>) : []))
            .then((tags) => {
                if (!Array.isArray(tags)) return;
                setSubTagNames(tags.map((t: { name?: unknown }) => t.name).filter((n): n is string => typeof n === "string" && n.length > 0));
            })
            .catch((e: unknown) => console.error("[KeywordSpendCard] 載入自訂子分類失敗", e));
    }, []);

    // 選單選項：預設 + 目前 + 最近查過（去重）；自訂子分類另成一組
    const recentOptions = useMemo(
        () => Array.from(new Set([DEFAULT_KEYWORD, ...(keyword ? [keyword] : []), ...history])),
        [history, keyword],
    );
    const subTagOptions = useMemo(
        () => Array.from(new Set([...usedSubTags, ...subTagNames])).filter((n) => !recentOptions.includes(n)),
        [usedSubTags, subTagNames, recentOptions],
    );
    const frequentOptions = useMemo(
        () => frequentTerms.filter((t) => !recentOptions.includes(t) && !subTagOptions.includes(t)),
        [frequentTerms, recentOptions, subTagOptions],
    );

    useEffect(() => {
        if (!keyword) return;
        let cancelled = false;
        setError(null);
        setData(null);
        fetch(`/api/dashboard/tag-trend?months=${range}&keyword=${encodeURIComponent(keyword)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<TagTrendResponse>;
            })
            .then((json) => {
                if (cancelled) return;
                setData(json);
                if (json.subTagsByTotal?.length) setUsedSubTags(json.subTagsByTotal.map((s) => s.subTag));
                if (json.frequentTerms?.length) setFrequentTerms(json.frequentTerms);
            })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗"); });
        return () => { cancelled = true; };
    }, [keyword, range]);

    const applyKeyword = (raw: string) => {
        const next = raw.trim().slice(0, 30);
        if (!next) return;
        const nextHistory = [next, ...history.filter((h) => h !== next)].slice(0, HISTORY_LIMIT);
        setKeyword(next);
        setHistory(nextHistory);
        setCustomMode(false);
        setDraft("");
        saveKeyword(next, nextHistory);
    };

    const onSelect = (value: string) => {
        if (value === CUSTOM_OPTION) {
            setCustomMode(true);
            return;
        }
        applyKeyword(value);
    };

    const submitCustom = (e: React.FormEvent) => {
        e.preventDefault();
        applyKeyword(draft);
    };

    const { chartData, total, count, avgPerMonth, avgPerTime, activeMonths } = useMemo(() => {
        const months = data?.months ?? [];
        const rows = months.map((m, i) => ({
            month: `${m.month.slice(2, 4)}/${m.month.slice(5)}`,
            amount: m.keywordAmount,
            count: m.keywordCount,
            cumulative: months.slice(0, i + 1).reduce((s, x) => s + x.keywordAmount, 0),
        }));
        const sum = months.reduce((s, m) => s + m.keywordAmount, 0);
        const n = months.reduce((s, m) => s + m.keywordCount, 0);
        // 平均每月從第一筆命中的月份起算，避免追蹤開始前的空白月份稀釋平均
        const firstIdx = months.findIndex((m) => m.keywordCount > 0);
        const span = firstIdx === -1 ? 0 : months.length - firstIdx;
        return {
            chartData: rows,
            total: sum,
            count: n,
            avgPerMonth: span > 0 ? Math.round(sum / span) : 0,
            avgPerTime: n > 0 ? Math.round(sum / n) : 0,
            activeMonths: span,
        };
    }, [data]);

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                <div>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        🔍 主題支出追蹤
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        記帳內容含關鍵字的支出，不分類別一起算
                    </p>
                </div>
                <RangeToggle value={range} onChange={setRange} />
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: customMode ? "8px" : "16px" }}>
                <select
                    value={customMode ? CUSTOM_OPTION : keyword}
                    onChange={(e) => onSelect(e.target.value)}
                    aria-label="追蹤主題"
                    style={fieldStyle}
                >
                    <optgroup label="最近查過">
                        {recentOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                    </optgroup>
                    {frequentOptions.length > 0 && (
                        <optgroup label="常出現的詞">
                            {frequentOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                        </optgroup>
                    )}
                    {subTagOptions.length > 0 && (
                        <optgroup label="子分類">
                            {subTagOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                        </optgroup>
                    )}
                    <option value={CUSTOM_OPTION}>＋ 自訂關鍵字…</option>
                </select>
            </div>

            {customMode && (
                <form onSubmit={submitCustom} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={30}
                        autoFocus
                        placeholder="輸入關鍵字，例如：生日"
                        aria-label="自訂關鍵字"
                        style={{ ...fieldStyle, background: "transparent" }}
                    />
                    <button
                        type="submit"
                        style={{
                            fontSize: "0.8rem",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            border: "none",
                            background: BAR_COLOR,
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        查詢
                    </button>
                    <button
                        type="button"
                        onClick={() => { setCustomMode(false); setDraft(""); }}
                        style={{
                            fontSize: "0.8rem",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid rgba(128,128,128,0.3)",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                        }}
                    >
                        取消
                    </button>
                </form>
            )}

            {error && <p style={{ color: "#f87171", fontSize: "0.8rem" }}>⚠️ 載入失敗（{error}）</p>}
            {!error && !data && <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>載入中…</p>}

            {data && count === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "24px 0" }}>
                    近 {range} 個月沒有含「{keyword}」的支出紀錄
                </p>
            )}

            {data && count > 0 && (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                        <Stat label={`近 ${range} 個月合計`} value={`$${total.toLocaleString()}`} color={BAR_COLOR} />
                        <Stat label={`平均每月（${activeMonths} 個月）`} value={`$${avgPerMonth.toLocaleString()}`} />
                        <Stat label={`每次平均（${count} 筆）`} value={`$${avgPerTime.toLocaleString()}`} />
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="month" tick={{ fill: "var(--text-muted, #9ca3af)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatAxisMoney} width={40} />
                            <YAxis yAxisId="cum" orientation="right" tick={{ fill: LINE_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatAxisMoney} width={40} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                            <Bar yAxisId="month" dataKey="amount" fill={BAR_COLOR} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Line yAxisId="cum" type="monotone" dataKey="cumulative" stroke={LINE_COLOR} strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "8px" }}>
                        長條＝當月金額（左軸），折線＝累計金額（右軸）
                    </p>
                </>
            )}
        </div>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</p>
        </div>
    );
}
