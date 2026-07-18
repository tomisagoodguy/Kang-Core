"use client";

import { useState } from "react";
import { TagBadge } from "./TagBadge";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";
import { Pencil, Trash2, Image as ImageIcon } from "lucide-react";

import type { AccountingEntryView } from "@/models/schema";
import { formatMoney } from "@/utils/currency";

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

    const isIncome = entry.tag === "Income";
    const currency = entry.currency || "TWD";
    const twdValue = entry.amountTWD ?? entry.amount;
    const amountClass = isIncome
        ? "accounting-card-amount low"
        : twdValue >= 1000
            ? "accounting-card-amount high"
            : twdValue >= 500
                ? "accounting-card-amount medium"
                : "accounting-card-amount low";

    const formattedAmount = `${isIncome ? "+" : "-"}${formatMoney(entry.amount, currency)}`;
    const twdSub = currency !== "TWD" && entry.amountTWD != null ? `≈ NT$${entry.amountTWD.toLocaleString()}` : null;

    return (
        <>
            <div className="glass-card accounting-card" style={{ cursor: "pointer", transition: "all 0.2s ease" }}>
                {entry.imageUrl ? (
                    <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", marginTop: "2px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={entry.imageUrl}
                            alt="Receipt"
                            style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 12,
                                flexShrink: 0,
                                border: "1px solid var(--border-glass)",
                                transition: "all 0.2s ease"
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = "scale(1.05)";
                                e.currentTarget.style.borderColor = "var(--border-glass-hover)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.borderColor = "var(--border-glass)";
                            }}
                        />
                    </a>
                ) : (
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "var(--bg-glass)",
                        border: "1px solid var(--border-glass)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        flexShrink: 0,
                        alignSelf: "flex-start",
                        marginTop: "2px"
                    }}>
                        <ImageIcon size={20} opacity={0.5} />
                    </div>
                )}

                <div className="accounting-card-content" style={{ gap: "8px" }}>
                    <div className="accounting-card-header" style={{ gap: "8px" }}>
                        <span className="accounting-card-date">{entry.date}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <TagBadge tag={entry.tag} />
                            {entry.subTag && (
                                <span style={{
                                    fontSize: "0.75rem",
                                    padding: "4px 10px",
                                    background: "var(--bg-glass)",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border-glass)",
                                    color: "var(--text-secondary)",
                                    fontWeight: 500
                                }}>
                                    {entry.subTag}
                                </span>
                            )}
                        </div>
                    </div>
                    <span
                        className="accounting-card-desc"
                        title={entry.description || entry.originalText || "—"}
                        style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-primary)" }}
                    >
                        {entry.description || entry.originalText || "—"}
                    </span>
                </div>

                <div className="accounting-card-right" style={{ gap: "12px", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span className={amountClass} style={{ fontSize: "1.125rem", fontWeight: 700 }}>{formattedAmount}</span>
                        {twdSub && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{twdSub}</span>}
                    </div>
                    <div className="card-actions">
                        <button className="card-action-btn" aria-label="Edit Entry" onClick={() => setEditOpen(true)} style={{ padding: "6px" }}>
                            <Pencil size={14} />
                        </button>
                        <button className="card-action-btn danger" aria-label="Delete Entry" onClick={() => setDeleteOpen(true)} style={{ padding: "6px" }}>
                            <Trash2 size={14} />
                        </button>
                    </div>
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
