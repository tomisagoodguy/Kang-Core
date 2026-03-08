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
        <div style={{
            position: "relative",
            margin: "0 0 24px",
            borderRadius: "16px",
            overflow: "hidden"
        }}>
            {/* Animated AI background glow */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(120deg, var(--accent) 0%, #3b82f6 50%, var(--accent-light) 100%)",
                opacity: 0.15,
                animation: "pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }} />

            <div className="glass-card" style={{
                padding: "20px",
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: "16px",
                position: "relative",
                zIndex: 1
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "12px", background: "rgba(124, 58, 237, 0.1)", color: "var(--accent-light)", flexShrink: 0, boxShadow: "0 0 16px rgba(124, 58, 237, 0.2)" }}>
                    <Sparkles size={20} />
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 8px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>AI 洞察與建議</span>
                        <button
                            onClick={() => fetchInsight(true)}
                            disabled={isRefreshing}
                            aria-label="Refresh insight"
                            style={{
                                background: "transparent",
                                border: "none",
                                cursor: isRefreshing ? "wait" : "pointer",
                                color: "var(--text-muted)",
                                display: "flex",
                                padding: "4px",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                if (!isRefreshing) e.currentTarget.style.color = "var(--accent-light)";
                            }}
                            onMouseLeave={(e) => {
                                if (!isRefreshing) e.currentTarget.style.color = "var(--text-muted)";
                            }}
                        >
                            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                        </button>
                    </h3>

                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                            <div className="skeleton" style={{ height: "16px", width: "100%", borderRadius: "4px" }}></div>
                            <div className="skeleton" style={{ height: "16px", width: "90%", borderRadius: "4px" }}></div>
                            <div className="skeleton" style={{ height: "16px", width: "60%", borderRadius: "4px" }}></div>
                        </div>
                    ) : (
                        <p style={{
                            fontSize: "0.9375rem",
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                            margin: 0,
                            fontStyle: "italic",
                            letterSpacing: "0.01em"
                        }}>
                            {insight}
                        </p>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.15; transform: scale(1); }
                    50% { opacity: 0.25; transform: scale(1.02); }
                }
            `}} />
        </div>
    );
}
