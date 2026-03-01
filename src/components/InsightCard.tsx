'use client';

import { useState, useEffect } from "react";

export function InsightCard() {
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInsight = async (force: boolean = false) => {
        setLoading(true);
        try {
            const res = await fetch("/api/insights");
            if (res.ok) {
                const data = await res.json();
                setInsight(data.insight);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsight();
    }, []);

    if (!insight && !loading) return null;

    return (
        <div className="glass-card" style={{ padding: "24px", marginBottom: "32px", border: "1px solid rgba(124, 58, 237, 0.3)", position: "relative", overflow: "hidden" }}>
            {/* Background Glow */}
            <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "100px", height: "100px", background: "var(--accent)", filter: "blur(60px)", opacity: 0.15, zIndex: 0 }}></div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: "1.5rem" }}>💡</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--accent-light)" }}>AI 理財洞察</h3>
            </div>

            {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                    <div className="login-spinner" style={{ width: "16px", height: "16px" }}></div>
                    <p style={{ fontSize: "0.9rem" }}>正在由 AI 顧問分析近期消費...</p>
                </div>
            ) : (
                <div style={{ color: "var(--text-primary)", fontSize: "0.9375rem", lineHeight: "1.8", whiteSpace: "pre-wrap", position: "relative", zIndex: 1 }}>
                    {insight}
                    <button
                        onClick={() => fetchInsight(true)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "12px", padding: 0, textDecoration: "underline" }}
                    >
                        重新產生分析
                    </button>
                </div>
            )}
        </div>
    );
}
