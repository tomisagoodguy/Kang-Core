'use client';

import { useState } from "react";
import type { ThreadsEntryView } from "@/models/schema";
import { deleteThreadAction, toggleThreadSaveAction } from "@/app/actions/threads";
import { Trash2, Heart, MessageCircle, ExternalLink, Sparkles, Pin, LoaderCircle, Tag } from "lucide-react";

interface ThreadsCardProps {
    entry: ThreadsEntryView;
}

export function ThreadsCard({ entry }: ThreadsCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [isSaved, setIsSaved] = useState(entry.isSaved || false);

    if (isDeleted) return null;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("確定要在洞察清單中隱藏或刪除這篇貼文嗎？")) {
            setIsDeleting(true);
            const res = await deleteThreadAction(entry.id);
            if (res.success) {
                setIsDeleted(true);
            } else {
                alert("移除失敗：" + res.error);
                setIsDeleting(false);
            }
        }
    };

    const handleToggleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isSaved;
        setIsSaved(newState);
        const res = await toggleThreadSaveAction(entry.id, newState);
        if (!res.success) {
            setIsSaved(!newState); // revert
            alert("儲存失敗：" + res.error);
        }
    };

    const publishedDate = entry.publishedAt
        ? new Date(entry.publishedAt).toLocaleDateString("zh-TW", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        })
        : "";

    return (
        <div
            className="glass-card threads-card"
            style={{
                borderLeft: isSaved ? "4px solid #fbbf24" : "4px solid rgba(161, 100, 255, 0.6)",
            }}
        >
            {/* 背景漸層裝飾 */}
            <div style={{
                position: "absolute",
                top: 0, right: 0,
                width: "120px", height: "120px",
                background: isSaved ? "radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)" : "radial-gradient(circle, rgba(161,100,255,0.08) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />

            {/* Header: 作者 + 動作 */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: "40px", height: "40px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent-light) 0%, var(--accent) 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", fontWeight: 700, color: "#fff",
                        flexShrink: 0,
                        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)"
                    }}>
                        {entry.author.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                @{entry.author}
                            </span>
                            {entry.isDiscovery && (
                                <span style={{
                                    background: "rgba(251,191,36,0.1)",
                                    border: "1px solid rgba(251,191,36,0.2)",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "0.65rem",
                                    color: "#fbbf24",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}>
                                    <Sparkles size={10} /> 自動發現
                                </span>
                            )}
                            {entry.matchedKeyword && (
                                <span style={{
                                    background: "rgba(161,100,255,0.1)",
                                    border: "1px solid rgba(161,100,255,0.2)",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "0.65rem",
                                    color: "var(--accent-light)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}>
                                    <Tag size={10} /> {entry.matchedKeyword}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {publishedDate}
                        </div>
                    </div>
                </div>

                {/* 右上角按鈕組 */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handleToggleSave}
                        title={isSaved ? "取消釘選" : "釘選保留"}
                        style={{
                            background: isSaved ? "rgba(251,191,36,0.15)" : "rgba(0,0,0,0.03)",
                            border: isSaved ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
                            borderRadius: "8px",
                            width: "32px", height: "32px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isSaved ? "#fbbf24" : "var(--text-muted)",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isSaved ? "rgba(251,191,36,0.25)" : "var(--bg-glass-hover)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSaved ? "rgba(251,191,36,0.15)" : "rgba(0,0,0,0.03)"; }}
                    >
                        <Pin size={16} strokeWidth={isSaved ? 3 : 2} fill={isSaved ? "#fbbf24" : "none"} />
                    </button>

                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        title="移除此廢文"
                        style={{
                            background: "rgba(0,0,0,0.03)",
                            border: "1px solid transparent",
                            borderRadius: "8px",
                            width: "32px", height: "32px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                    >
                        {isDeleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                </div>
            </div>

            {/* 貼文全文 */}
            <div className="threads-card-preview">
                {entry.content}
            </div>

            {/* Footer: 互動數 + 連結 */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "auto",
                borderTop: "1px solid var(--border-glass)",
                paddingTop: "16px",
                zIndex: 1
            }}>
                <div style={{ display: "flex", gap: "16px" }}>
                    {entry.likeCount !== undefined && (
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Heart size={14} color="#ec4899" />
                            {entry.likeCount.toLocaleString()}
                        </span>
                    )}
                    {entry.replyCount !== undefined && (
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <MessageCircle size={14} color="#3b82f6" />
                            {entry.replyCount.toLocaleString()}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <a
                        href={entry.threadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            color: "var(--accent-light)",
                            textDecoration: "none",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "rgba(161,100,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(161,100,255,0.2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(161,100,255,0.1)")}
                    >
                        查看原文 <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
}
