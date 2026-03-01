'use client';

import { useState } from "react";
import { TagBadge } from "./TagBadge";

interface ArchiveEntry {
    id: string;
    summary: string;
    keywords: string[];
    url?: string;
    title?: string;
    imageUrl?: string;
    createdAt?: string;
    originalText?: string;
}

interface ArchiveCardProps {
    entry: ArchiveEntry;
}

export function ArchiveCard({ entry }: ArchiveCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    let displayTitle = entry.title || "知識存檔";
    if (!entry.title && entry.url) {
        try { displayTitle = new URL(entry.url).hostname; } catch { /* invalid URL */ }
    }
    // 不截斷摘要，由 CSS -webkit-line-clamp 控制顯示行數
    const summary = entry.summary;

    return (
        <div
            className="glass-card archive-card"
            style={{
                cursor: "pointer",
                gridColumn: isExpanded ? "1 / -1" : "auto",
                transition: "all 0.3s ease",
            }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {entry.imageUrl && (
                <a
                    href={entry.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={entry.imageUrl}
                        alt="截圖"
                        style={{
                            width: "100%",
                            height: isExpanded ? "auto" : 140,
                            maxHeight: isExpanded ? 500 : 140,
                            objectFit: "contain",
                            backgroundColor: "rgba(0,0,0,0.5)",
                            borderRadius: 8,
                            marginBottom: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            transition: "all 0.3s ease",
                        }}
                    />
                </a>
            )}

            <div className="archive-card-title" style={isExpanded ? { WebkitLineClamp: "unset", display: "block" } : {}} title={displayTitle}>
                {displayTitle}
            </div>

            <div className="archive-card-summary" style={isExpanded ? { WebkitLineClamp: "unset", display: "block" } : {}}>
                {summary}
            </div>

            {/* 展開時顯示原始內容 */}
            {isExpanded && entry.originalText && (
                <div style={{
                    marginTop: "12px",
                    padding: "16px",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                    border: "1px solid rgba(255, 255, 255, 0.05)"
                }}>
                    <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>📝 原始內容：</strong>
                    {entry.originalText}
                </div>
            )}

            <div className="archive-card-keywords" style={{ marginTop: isExpanded ? "16px" : "auto" }}>
                {(isExpanded ? entry.keywords : entry.keywords.slice(0, 4)).map((kw) => (
                    <TagBadge key={kw} tag={kw} />
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                {entry.url ? (
                    <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="archive-card-link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        🔗 查看原始連結
                    </a>
                ) : <span />}

                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {isExpanded ? "▲ 點擊收起" : "▼ 點擊展開"}
                </span>
            </div>
        </div>
    );
}
