'use client';

import { useState } from "react";
import type { ThreadsEntryView } from "@/models/schema";

interface ThreadsCardProps {
    entry: ThreadsEntryView;
}

export function ThreadsCard({ entry }: ThreadsCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const publishedDate = entry.publishedAt
        ? new Date(entry.publishedAt).toLocaleDateString("zh-TW", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        })
        : "";

    const truncatedContent = entry.content.length > 120 && !isExpanded
        ? entry.content.slice(0, 120) + "..."
        : entry.content;

    return (
        <div
            className="glass-card"
            style={{
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                borderLeft: "3px solid rgba(161, 100, 255, 0.6)",
                position: "relative",
                overflow: "hidden",
            }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* 背景漸層裝飾 */}
            <div style={{
                position: "absolute",
                top: 0, right: 0,
                width: "80px", height: "80px",
                background: "radial-gradient(circle, rgba(161,100,255,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />

            {/* Header: 作者 + 時間 */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                {/* Avatar placeholder */}
                <div style={{
                    width: "36px", height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #a164ff 0%, #6e3cca 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: 700, color: "#fff",
                    flexShrink: 0,
                }}>
                    {entry.author.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span style={{
                            background: "rgba(161,100,255,0.15)",
                            padding: "1px 8px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            color: "#c084fc",
                        }}>
                            🧵
                        </span>
                        @{entry.author}
                        {entry.isDiscovery && (
                            <span style={{
                                background: "rgba(251,191,36,0.15)",
                                padding: "1px 6px",
                                borderRadius: "8px",
                                fontSize: "0.65rem",
                                color: "#fbbf24",
                            }}>
                                ✨ 自動發現
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {publishedDate}
                    </div>
                </div>
            </div>

            {/* 貼文內容 */}
            <div style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginBottom: "12px",
            }}>
                {truncatedContent}
            </div>

            {/* Footer: 互動數 + 連結 */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
            }}>
                <div style={{ display: "flex", gap: "14px" }}>
                    {entry.likeCount !== undefined && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "0.85rem" }}>❤️</span>
                            {entry.likeCount.toLocaleString()}
                        </span>
                    )}
                    {entry.replyCount !== undefined && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "0.85rem" }}>💬</span>
                            {entry.replyCount.toLocaleString()}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {isExpanded ? "▲ 收起" : "▼ 展開"}
                    </span>
                    <a
                        href={entry.threadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            fontSize: "0.75rem",
                            color: "#c084fc",
                            textDecoration: "none",
                            padding: "3px 10px",
                            borderRadius: "12px",
                            border: "1px solid rgba(161,100,255,0.3)",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(161,100,255,0.15)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                        查看原文 →
                    </a>
                </div>
            </div>
        </div>
    );
}
