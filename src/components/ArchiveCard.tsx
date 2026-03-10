'use client';

import { useState } from "react";
import { TagBadge } from "./TagBadge";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";
import type { ArchiveEntryView } from "@/models/schema";
import { FileText, ExternalLink, Pencil, Trash2 } from "lucide-react";

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
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    let displayTitle = entry.title || "知識存檔";
    if (!entry.title && entry.url) {
        try { displayTitle = new URL(entry.url).hostname; } catch { /* invalid URL */ }
    }

    // Show original text preferentially if it exists, otherwise summary.
    const contentToDisplay = entry.originalText || entry.summary;

    return (
        <>
            <div
                className="glass-card archive-card"
                style={{
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden"
                }}
            >
                {entry.imageUrl && (
                    <a
                        href={entry.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ alignSelf: "flex-start", width: "100%" }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={entry.imageUrl}
                            alt="截圖"
                            style={{
                                width: "100%",
                                height: 140,
                                objectFit: "cover",
                                backgroundColor: "rgba(0,0,0,0.5)",
                                borderRadius: 12,
                                marginBottom: 4,
                                border: "1px solid var(--border-glass)",
                                transition: "transform 0.3s ease, border-color 0.3s ease",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = "var(--border-glass-hover)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = "var(--border-glass)";
                            }}
                        />
                    </a>
                )}

                <div className="archive-card-title" title={displayTitle} style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    display: "-webkit-box",
                    WebkitLineClamp: "2",
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                }}>
                    {displayTitle}
                </div>

                <div className="custom-scrollbar" style={{
                    fontSize: "0.9375rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    maxHeight: "150px",
                    overflowY: "auto",
                    paddingRight: "8px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word"
                }}>
                    {contentToDisplay && (
                        <>
                            {entry.originalText && (
                                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                    <FileText size={16} /> 原始內容：
                                </strong>
                            )}
                            {contentToDisplay}
                        </>
                    )}
                </div>

                <div className="archive-card-keywords" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto" }}>
                    {entry.keywords.slice(0, 6).map((kw) => (
                        <TagBadge key={kw} tag={kw} />
                    ))}
                    {entry.keywords.length > 6 && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>+{entry.keywords.length - 6}</span>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-glass)" }}>
                    {entry.url ? (
                        <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="archive-card-link"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.8125rem",
                                fontWeight: 500,
                                color: "var(--accent-light)",
                                textDecoration: "none",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                background: "rgba(161,100,255,0.1)",
                                transition: "all 0.2s ease"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(161,100,255,0.2)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "rgba(161,100,255,0.1)")}
                        >
                            原始連結 <ExternalLink size={14} />
                        </a>
                    ) : <span />}

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <div className="card-actions" style={{ opacity: 1 }}>
                            <button className="card-action-btn" onClick={() => setEditOpen(true)} title="編輯" style={{ padding: "6px" }}>
                                <Pencil size={14} />
                            </button>
                            <button className="card-action-btn danger" onClick={() => setDeleteOpen(true)} title="刪除" style={{ padding: "6px" }}>
                                <Trash2 size={14} />
                            </button>
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
