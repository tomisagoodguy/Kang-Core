'use client';

import { useState } from "react";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";
import type { ArchiveEntryView } from "@/models/schema";
import { FileText, ExternalLink, Pencil, Trash2, Link2, ChevronDown, ChevronUp } from "lucide-react";

interface ArchiveCardProps {
    entry: ArchiveEntryView;
}

const EDIT_FIELDS = [
    { key: "title", label: "標題", type: "text" as const },
    { key: "summary", label: "摘要", type: "textarea" as const },
    { key: "keywords", label: "關鍵字 (逗號分隔)", type: "text" as const },
    { key: "url", label: "連結", type: "text" as const },
];

function getDomain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
}

function getFaviconUrl(url: string): string {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`; }
    catch { return ""; }
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

const KEYWORD_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#eab308",
    "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];
function getKwColor(kw: string): string {
    let h = 0;
    for (let i = 0; i < kw.length; i++) h = (h * 31 + kw.charCodeAt(i)) % KEYWORD_COLORS.length;
    return KEYWORD_COLORS[Math.abs(h)];
}

export function ArchiveCard({ entry }: ArchiveCardProps) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [hovered, setHovered] = useState(false);

    const displayTitle = entry.title || (entry.url ? getDomain(entry.url) : "筆記");
    const summary = entry.summary || entry.originalText || "";
    const isLong = summary.length > 120;
    const displaySummary = expanded || !isLong ? summary : summary.slice(0, 120) + "…";

    return (
        <>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-glass)",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow: hovered ? "0 4px 24px rgba(0,0,0,0.12)" : "none",
                    borderColor: hovered ? "var(--border-glass-hover)" : "var(--border-glass)",
                    position: "relative",
                }}
            >
                {/* Header row: source + date + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        {entry.url ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getFaviconUrl(entry.url)} alt="" width={14} height={14} style={{ flexShrink: 0, opacity: 0.8 }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {getDomain(entry.url)}
                                </span>
                                <Link2 size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            </>
                        ) : (
                            <>
                                <FileText size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>筆記</span>
                            </>
                        )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {entry.createdAt && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                {formatDate(entry.createdAt)}
                            </span>
                        )}
                        <div style={{ display: "flex", gap: "2px", opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}>
                            <button
                                className="card-action-btn"
                                onClick={() => setEditOpen(true)}
                                style={{ padding: "4px" }}
                                title="編輯"
                            >
                                <Pencil size={12} />
                            </button>
                            <button
                                className="card-action-btn danger"
                                onClick={() => setDeleteOpen(true)}
                                style={{ padding: "4px" }}
                                title="刪除"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Image */}
                {entry.imageUrl && (
                    <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={entry.imageUrl}
                            alt="截圖"
                            style={{
                                width: "100%",
                                height: 120,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid var(--border-glass)",
                            }}
                        />
                    </a>
                )}

                {/* Title */}
                <div style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: "2",
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                }}>
                    {displayTitle}
                </div>

                {/* Summary */}
                {summary && (
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {displaySummary}
                        {isLong && (
                            <button
                                onClick={() => setExpanded(v => !v)}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    marginLeft: "6px",
                                    fontSize: "0.75rem",
                                    color: "var(--accent-light)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    fontWeight: 500,
                                }}
                            >
                                {expanded ? <><ChevronUp size={12} /> 收起</> : <><ChevronDown size={12} /> 展開</>}
                            </button>
                        )}
                    </div>
                )}

                {/* Keywords */}
                {entry.keywords.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "2px" }}>
                        {entry.keywords.slice(0, 7).map((kw) => {
                            const color = getKwColor(kw);
                            return (
                                <span
                                    key={kw}
                                    style={{
                                        fontSize: "0.69rem",
                                        padding: "2px 8px",
                                        borderRadius: "10px",
                                        background: `${color}18`,
                                        border: `1px solid ${color}33`,
                                        color: color,
                                        fontWeight: 500,
                                        letterSpacing: "0.01em",
                                    }}
                                >
                                    {kw}
                                </span>
                            );
                        })}
                        {entry.keywords.length > 7 && (
                            <span style={{ fontSize: "0.69rem", color: "var(--text-muted)", alignSelf: "center" }}>
                                +{entry.keywords.length - 7}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer link */}
                {entry.url && (
                    <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "0.78rem",
                            color: "var(--accent-light)",
                            textDecoration: "none",
                            marginTop: "auto",
                            paddingTop: "8px",
                            borderTop: "1px solid var(--border-glass)",
                            fontWeight: 500,
                        }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                    >
                        前往原始連結 <ExternalLink size={12} />
                    </a>
                )}
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
