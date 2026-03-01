"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CalendarEntry {
    id: string;
    title: string;
    actionDate?: string;
    actionTime?: string;
    description?: string;
    status: "pending" | "done";
}

interface CalendarCardProps {
    entry: CalendarEntry;
}

export function CalendarCard({ entry }: CalendarCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("確定要刪除這筆代辦/行事曆嗎？")) return;
        setIsDeleting(true);
        try {
            await fetch(`/api/calendar/${entry.id}`, { method: "DELETE" });
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("刪除失敗");
            setIsDeleting(false);
        }
    };

    const handleToggleStatus = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCompleting(true);
        try {
            const newStatus = entry.status === "pending" ? "done" : "pending";
            // Optimistic behavior: we assume it updates correctly, we could just refresh
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
                    <div style={{ fontSize: "0.8რემ", color: "var(--text-secondary)", marginTop: "4px" }}>
                        {entry.actionDate && <span>📅 {entry.actionDate} </span>}
                        {entry.actionTime && <span>⏰ {entry.actionTime}</span>}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
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
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            opacity: isDeleting ? 0.5 : 0.8,
                            filter: "grayscale(0.5)",
                            transition: "all 0.2s"
                        }}
                        title="刪除"
                    >
                        🗑️
                    </button>
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
    );
}
