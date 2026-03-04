"use client";

import { useState } from "react";
import { TagBadge } from "./TagBadge";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";

import type { AccountingEntryView } from "@/models/schema";

interface AccountingCardProps {
    entry: AccountingEntryView;
}

const EDIT_FIELDS = [
    { key: "amount", label: "金額", type: "number" as const },
    { key: "tag", label: "標籤", type: "text" as const },
    { key: "subTag", label: "子標籤", type: "text" as const },
    { key: "date", label: "日期", type: "date" as const },
    { key: "description", label: "說明", type: "text" as const },
];

export function AccountingCard({ entry }: AccountingCardProps) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const amountClass =
        entry.amount >= 1000
            ? "accounting-card-amount high"
            : entry.amount >= 500
                ? "accounting-card-amount medium"
                : "accounting-card-amount low";

    const formattedAmount = entry.amount.toLocaleString();

    return (
        <>
            <div className="glass-card accounting-card">
                {entry.imageUrl && (
                    <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={entry.imageUrl}
                            alt="收據"
                            style={{
                                width: 56,
                                height: 56,
                                objectFit: "cover",
                                borderRadius: 8,
                                flexShrink: 0,
                                border: "1px solid rgba(255,255,255,0.1)",
                            }}
                        />
                    </a>
                )}
                <span className="accounting-card-date">{entry.date}</span>
                <span className="accounting-card-desc">
                    {entry.description || entry.originalText || "—"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <TagBadge tag={entry.tag} />
                    {entry.subTag && (
                        <span style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "var(--text-secondary)"
                        }}>
                            {entry.subTag}
                        </span>
                    )}
                </div>
                <span className={amountClass}>${formattedAmount}</span>
                <div className="card-actions">
                    <button className="card-action-btn" onClick={() => setEditOpen(true)}>✏️</button>
                    <button className="card-action-btn danger" onClick={() => setDeleteOpen(true)}>🗑️</button>
                </div>
            </div>

            <EditModal
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                entry={entry as unknown as Record<string, unknown>}
                collection="accounting"
                fields={EDIT_FIELDS}
            />
            <DeleteConfirm
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                entryId={entry.id}
                collection="accounting"
                label={entry.description || `$${formattedAmount}`}
            />
        </>
    );
}
