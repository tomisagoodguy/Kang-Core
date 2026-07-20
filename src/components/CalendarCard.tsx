"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";

import { Calendar, Clock, CheckSquare, Square, Pencil, Trash2, CalendarDays, AlignLeft } from "lucide-react";

import type { CalendarEntryView } from "@/models/schema";

interface CalendarCardProps {
    entry: CalendarEntryView;
}

const EDIT_FIELDS = [
    { key: "title", label: "標題", type: "text" as const },
    { key: "actionDate", label: "日期", type: "date" as const },
    { key: "actionTime", label: "時間 (HH:mm)", type: "text" as const },
    { key: "description", label: "說明", type: "textarea" as const },
];

export function CalendarCard({ entry }: CalendarCardProps) {
    const router = useRouter();
    const [isCompleting, setIsCompleting] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const handleToggleStatus = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCompleting(true);
        try {
            await fetch(`/api/calendar/${entry.id}/toggle`, { method: "POST" });
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("更新狀態失敗");
            setIsCompleting(false);
        }
    };

    const isDone = entry.status === "done";

    return (
        <>
            <div
                className="glass-card calendar-card"
                style={{
                    opacity: isDone ? 0.6 : 1,
                    borderLeft: isDone ? "4px solid var(--success, #4CAF50)" : "4px solid var(--warning, #FFC107)",
                    transition: "all 0.3s"
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h3 style={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            margin: 0,
                            textDecoration: isDone ? "line-through" : "none",
                            color: "var(--text-primary)"
                        }}>
                            {entry.title}
                        </h3>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "6px", display: "flex", gap: "12px", alignItems: "center" }}>
                            {entry.actionDate && <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={12} /> {entry.actionDate}</span>}
                            {entry.actionTime && <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {entry.actionTime}</span>}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {/* Only show actions if it's not a read-only Google Calendar/Tasks item */}
                        {!entry.id.startsWith("gcal-") && !entry.id.startsWith("task-") && (
                            <>
                                <button
                                    onClick={handleToggleStatus}
                                    disabled={isCompleting}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: isDone ? "var(--success)" : "var(--text-secondary)",
                                        transition: "transform 0.2s",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "4px"
                                    }}
                                    title={isDone ? "標為未完成" : "標為已完成"}
                                >
                                    {isDone ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>
                                <div className="card-actions" style={{ opacity: 1 }}>
                                    <button className="card-action-btn" onClick={() => setEditOpen(true)} title="編輯">
                                        <Pencil size={14} />
                                    </button>
                                    <button className="card-action-btn danger" onClick={() => setDeleteOpen(true)} title="刪除">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                        {entry.id.startsWith("gcal-") && (
                            <div style={{ color: "var(--brand-google)", display: "flex", alignItems: "center", padding: "4px" }} title="來自 Google 行事曆">
                                <CalendarDays size={18} />
                            </div>
                        )}
                        {entry.id.startsWith("task-") && (
                            <div style={{ color: "#FBBC05", display: "flex", alignItems: "center", padding: "4px" }} title="來自 Google Tasks">
                                <CheckSquare size={18} />
                            </div>
                        )}
                    </div>
                </div>

                {entry.description && (
                    <div style={{
                        fontSize: "0.875rem",
                        color: "var(--text-muted)",
                        background: "rgba(0,0,0,0.2)",
                        padding: "8px",
                        borderRadius: "6px",
                        marginTop: "4px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px"
                    }}>
                        <AlignLeft size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>{entry.description}</span>
                    </div>
                )}
            </div>

            <EditModal
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                entry={entry as unknown as Record<string, unknown>}
                collection="calendar"
                fields={EDIT_FIELDS}
            />
            <DeleteConfirm
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                entryId={entry.id}
                collection="calendar"
                label={entry.title}
            />
        </>
    );
}
