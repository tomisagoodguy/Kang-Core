"use client";

import React from "react";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
    const mainColor = color || "var(--accent-light)";

    return (
        <div
            className="glass-card stat-card"
            style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden"
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "var(--shadow-glass-hover)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-glass)";
            }}
        >
            <div style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                width: "100px",
                height: "100px",
                background: `radial-gradient(circle, ${mainColor}20 0%, transparent 70%)`,
                pointerEvents: "none",
                zIndex: 0
            }} />

            <div
                className="stat-card-icon"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: `linear-gradient(135deg, ${mainColor}15 0%, ${mainColor}05 100%)`,
                    border: `1px solid ${mainColor}30`,
                    color: mainColor,
                    zIndex: 1,
                    boxShadow: `0 4px 12px ${mainColor}15`
                }}
            >
                {icon}
            </div>

            <div style={{ zIndex: 1 }}>
                <div
                    className="stat-card-value"
                    style={{
                        color: "var(--text-primary)",
                        fontSize: "1.875rem",
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        marginBottom: "4px"
                    }}
                >
                    {value}
                </div>
                <div
                    className="stat-card-label"
                    style={{
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        fontWeight: 600
                    }}
                >
                    {label}
                </div>
            </div>
        </div>
    );
}
