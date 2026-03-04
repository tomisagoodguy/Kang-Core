'use client';

import { useState } from "react";
import { TagBadge } from "./TagBadge";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";
import type { ArchiveEntryView } from "@/models/schema";

interface ArchiveCardProps {
    entry: ArchiveEntryView;
}

const EDIT_FIELDS = [
    { key: "title", label: "標題", type: "text" as const },
    { key: "summary", label: "摘要", type: "textarea" as const },
    { key: "keywords", label: "關鍵字 (逗號分隔)", type: "text" as const },
    { key: "url", label: "連結", type: "text" as const },
];

export function ArchiveCard({ entry }: ArchiveCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    let displayTitle = entry.title || "知識存檔";
    if (!entry.title && entry.url) {
        try { displayTitle = new URL(entry.url).hostname; } catch { /* invalid URL */ }
    }
    const summary = entry.summary;

    return (
        <>
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

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {isExpanded ? "▲ 收起" : "▼ 展開"}
                        </span>
                        <div className="card-actions" style={{ opacity: 1 }}>
                            <button className="card-action-btn" onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>✏️</button>
                            <button className="card-action-btn danger" onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}>🗑️</button>
                        </div>
                    </div>
                </div>
            </div>

            <EditModal
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                entry={entry as unknown as Record<string, unknown>}
                collection="archive"
                fields={EDIT_FIELDS}
            />
            <DeleteConfirm
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                entryId={entry.id}
                collection="archive"
                label={displayTitle}
            />
        </>
    );
}
