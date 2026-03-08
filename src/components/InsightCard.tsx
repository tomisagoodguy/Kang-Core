'use client';

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

export function InsightCard() {
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchInsight = async (force: boolean = false) => {
        if (force) setIsRefreshing(true);
        try {
            const url = force ? "/api/insights?force=true" : "/api/insights";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setInsight(data.insight);
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

    return (
        <div className="glass-card" style={{ padding: "24px", marginBottom: "32px", border: "1px solid rgba(124, 58, 237, 0.3)", position: "relative", overflow: "hidden" }}>
            {/* Background Glow */}
            <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "150px", height: "150px", background: "var(--accent)", filter: "blur(80px)", opacity: 0.15, zIndex: 0 }}></div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                <Sparkles size={24} className="text-accent" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--accent-light)" }}>AI 理財洞察</h3>
            </div>

            {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)", minHeight: "60px" }}>
                    <div className="login-spinner" style={{ width: "20px", height: "20px" }}></div>
                    <p style={{ fontSize: "0.9375rem" }}>正在由 AI 顧問分析近期消費...</p>
                </div>
            ) : (
                <div style={{ color: "var(--text-primary)", fontSize: "0.95rem", lineHeight: "1.8", whiteSpace: "pre-wrap", position: "relative", zIndex: 1 }}>
                    {insight}

                    <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                            onClick={() => fetchInsight(true)}
                            disabled={isRefreshing}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "var(--bg-glass)",
                                border: "1px solid var(--border-glass)",
                                borderRadius: "6px",
                                color: "var(--text-secondary)",
                                fontSize: "0.8125rem",
                                padding: "6px 12px",
                                cursor: isRefreshing ? "not-allowed" : "pointer",
                                opacity: isRefreshing ? 0.7 : 1,
                                transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => {
                                if (!isRefreshing) {
                                    e.currentTarget.style.color = "var(--text-primary)";
                                    e.currentTarget.style.background = "var(--border-glass-hover)";
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isRefreshing) {
                                    e.currentTarget.style.color = "var(--text-secondary)";
                                    e.currentTarget.style.background = "var(--bg-glass)";
                                }
                            }}
                        >
                            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                            {isRefreshing ? "重新分析中..." : "重新產生分析"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
