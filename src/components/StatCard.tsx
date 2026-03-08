import React from "react";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
    return (
        <div className="glass-card stat-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="stat-card-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "12px", background: "rgba(0,0,0,0.03)", color: color || "var(--accent-light)" }}>
                {icon}
            </div>
            <div>
                <div
                    className="stat-card-value"
                    style={color ? { color, fontSize: "1.75rem", fontWeight: 700, marginBottom: "4px" } : { color: 'var(--accent-light)', fontSize: "1.75rem", fontWeight: 700, marginBottom: "4px" }}
                >
                    {value}
                </div>
                <div className="stat-card-label" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
            </div>
        </div>
    );
}
