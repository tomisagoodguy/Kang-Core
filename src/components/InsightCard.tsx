'use client';

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface InsightItem {
    index: number;
    label: string;
    content: string;
}

const ITEM_LABELS = ["收支分析", "過度消費", "理財建議"];
const ITEM_COLORS = ["#6366f1", "#f97316", "#22c55e"];

function parseInsightItems(text: string): InsightItem[] {
    // Split by numbered lines: "1.", "2.", "3." at start of line
    const parts = text.split(/\n?(\d+)[.、]\s+/).filter(s => s.trim());
    const items: InsightItem[] = [];

    let i = 0;
    while (i < parts.length) {
        const maybeNum = parseInt(parts[i]);
        if (!isNaN(maybeNum) && parts[i + 1]) {
            items.push({
                index: maybeNum,
                label: ITEM_LABELS[maybeNum - 1] ?? `觀點 ${maybeNum}`,
                content: parts[i + 1].trim(),
            });
            i += 2;
        } else {
            i++;
        }
    }

    // Fallback: if parsing fails, wrap whole text
    if (items.length === 0) {
        return [{ index: 1, label: "AI 建議", content: text.trim() }];
    }

    return items;
}

export function InsightCard() {
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    const fetchInsight = async (force: boolean = false) => {
        if (force) setIsRefreshing(true);
        try {
            const url = force ? "/api/insights?force=true" : "/api/insights";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setInsight(data.insight);
                setExpandedIndex(0);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInsight();
    }, []);

    if (!insight && !loading) return null;

    const items = insight ? parseInsightItems(insight) : [];

    return (
        <div style={{
            position: "relative",
            margin: "0 0 24px",
            borderRadius: "16px",
            overflow: "hidden",
        }}>
            {/* Background glow */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(120deg, var(--accent) 0%, #3b82f6 50%, var(--accent-light) 100%)",
                opacity: 0.12,
                animation: "insight-pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }} />

            <div className="glass-card" style={{
                padding: "20px",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: "16px",
                position: "relative",
                zIndex: 1,
            }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "10px",
                        background: "rgba(124, 58, 237, 0.12)",
                        color: "var(--accent-light)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <Sparkles size={18} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", flex: 1 }}>
                        AI 洞察與建議
                    </span>
                    <button
                        onClick={() => fetchInsight(true)}
                        disabled={isRefreshing}
                        aria-label="重新整理"
                        style={{
                            background: "transparent", border: "none",
                            cursor: isRefreshing ? "wait" : "pointer",
                            color: "var(--text-muted)", display: "flex", padding: "4px",
                            transition: "color 0.2s",
                        }}
                        onMouseEnter={e => { if (!isRefreshing) e.currentTarget.style.color = "var(--accent-light)"; }}
                        onMouseLeave={e => { if (!isRefreshing) e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                        <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Items */}
                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {[100, 85, 70].map((w, i) => (
                            <div key={i} className="skeleton" style={{ height: "54px", width: `${w}%`, borderRadius: "10px" }} />
                        ))}
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {items.map((item, i) => {
                            const color = ITEM_COLORS[i] ?? "#94a3b8";
                            const isOpen = expandedIndex === i;
                            return (
                                <div
                                    key={item.index}
                                    onClick={() => setExpandedIndex(isOpen ? null : i)}
                                    style={{
                                        borderRadius: "10px",
                                        border: `1px solid ${isOpen ? color + "44" : "var(--border-glass)"}`,
                                        background: isOpen ? `${color}0d` : "var(--bg-glass)",
                                        padding: "12px 14px",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        {/* Number badge */}
                                        <div style={{
                                            width: 24, height: 24, borderRadius: "50%",
                                            background: `${color}22`,
                                            border: `1px solid ${color}44`,
                                            color: color,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            flexShrink: 0,
                                        }}>
                                            {item.index}
                                        </div>

                                        {/* Label */}
                                        <span style={{
                                            fontSize: "0.8125rem",
                                            fontWeight: 600,
                                            color: isOpen ? color : "var(--text-secondary)",
                                            flex: 1,
                                            transition: "color 0.2s",
                                        }}>
                                            {item.label}
                                        </span>

                                        {/* Expand icon */}
                                        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                                            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                        </span>
                                    </div>

                                    {/* Expanded content */}
                                    {isOpen && (
                                        <p style={{
                                            margin: "10px 0 0 34px",
                                            fontSize: "0.875rem",
                                            color: "var(--text-primary)",
                                            lineHeight: 1.65,
                                            fontStyle: "italic",
                                        }}>
                                            {item.content}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes insight-pulse {
                    0%, 100% { opacity: 0.12; transform: scale(1); }
                    50% { opacity: 0.2; transform: scale(1.02); }
                }
            ` }} />
        </div>
    );
}
