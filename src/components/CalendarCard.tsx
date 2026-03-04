"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";

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
                className="glass-card"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
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
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                            {entry.actionDate && <span>📅 {entry.actionDate} </span>}
                            {entry.actionTime && <span>⏰ {entry.actionTime}</span>}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                            onClick={handleToggleStatus}
                            disabled={isCompleting}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.2rem",
                                transition: "transform 0.2s",
                            }}
                            title={isDone ? "標為未完成" : "標為已完成"}
                        >
                            {isDone ? "✅" : "🔲"}
                        </button>
                        <div className="card-actions" style={{ opacity: 1 }}>
                            <button className="card-action-btn" onClick={() => setEditOpen(true)}>✏️</button>
                            <button className="card-action-btn danger" onClick={() => setDeleteOpen(true)}>🗑️</button>
                        </div>
                    </div>
                </div>

                {entry.description && (
                    <div style={{
                        fontSize: "0.875rem",
                        color: "var(--text-muted)",
                        background: "rgba(0,0,0,0.2)",
                        padding: "8px",
                        borderRadius: "6px",
                        marginTop: "4px"
                    }}>
                        📝 {entry.description}
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
