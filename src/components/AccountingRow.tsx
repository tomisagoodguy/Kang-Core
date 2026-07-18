"use client";

import { useState } from "react";
import { Pencil, Trash2, Camera } from "lucide-react";
import { EditModal } from "./EditModal";
import { DeleteConfirm } from "./DeleteConfirm";
import { getTagEmoji } from "@/utils/tagEmoji";
import { formatMoney, PAYMENT_LABELS, settlementNote } from "@/utils/currency";
import type { AccountingEntryView } from "@/models/schema";

interface AccountingRowProps {
    entry: AccountingEntryView;
}

const EDIT_FIELDS = [
    { key: "amount", label: "金額", type: "number" as const },
    { key: "tag", label: "標籤", type: "text" as const },
    { key: "subTag", label: "子標籤", type: "text" as const },
    { key: "date", label: "日期", type: "date" as const },
    { key: "description", label: "說明", type: "text" as const },
];

const TAG_COLOR_MAP: Record<string, string> = {
    Food: "#f97316",
    Transport: "#3b82f6",
    Entertainment: "#a855f7",
    Utilities: "#eab308",
    Shopping: "#ec4899",
    Health: "#22c55e",
    Education: "#6366f1",
    Insurance: "#64748b",
    Subscription: "#8b5cf6",
    Investment: "#0ea5e9",
    Travel: "#14b8a6",
    Income: "#10b981",
    Other: "#94a3b8",
};

export function AccountingRow({ entry }: AccountingRowProps) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [hovered, setHovered] = useState(false);

    const isIncome = entry.tag === "Income";
    const tagColor = TAG_COLOR_MAP[entry.tag ?? "Other"] ?? "#94a3b8";
    const emoji = getTagEmoji(entry.tag ?? "Other");
    const desc = entry.description || entry.originalText || "—";
    const currency = entry.currency || "TWD";
    const isForeign = currency !== "TWD";
    const formattedAmount = `${isIncome ? "+" : "-"}${formatMoney(entry.amount ?? 0, currency)}`;
    const twdSub = isForeign && entry.amountTWD != null ? `≈ NT$${entry.amountTWD.toLocaleString()}` : null;
    // 顏色門檻依台幣值判斷（外幣的原始數字大小無意義）
    const twdValue = entry.amountTWD ?? entry.amount ?? 0;
    const payment = entry.paymentMethod ? PAYMENT_LABELS[entry.paymentMethod] : null;
    const settle = settlementNote(entry);

    return (
        <>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: hovered ? "var(--bg-glass)" : "transparent",
                    transition: "background 0.15s",
                    cursor: "default",
                    minHeight: "44px",
                }}
            >
                {/* Tag emoji circle */}
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `${tagColor}22`,
                    border: `1px solid ${tagColor}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    flexShrink: 0,
                }}>
                    {emoji}
                </div>

                {/* Description + secondary line */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}>
                        {desc}
                    </span>
                    {(payment || settle) && (
                        <span style={{
                            fontSize: "0.7rem",
                            color: settle && !entry.settlement?.settled ? "#fb923c" : "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {payment ? `${payment.emoji} ${payment.label}` : ""}
                            {payment && settle ? "　" : ""}
                            {settle ?? ""}
                        </span>
                    )}
                </div>

                {/* Tag + SubTag pill（顯示分類文字，不用只憑 emoji 辨識） */}
                <span style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    background: `${tagColor}18`,
                    borderRadius: "10px",
                    border: `1px solid ${tagColor}40`,
                    color: tagColor,
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                }}>
                    {entry.tag ?? "Other"}{entry.subTag ? ` · ${entry.subTag}` : ""}
                </span>

                {/* Receipt icon */}
                {entry.imageUrl && (
                    <a
                        href={entry.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--text-muted)", flexShrink: 0, lineHeight: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Camera size={13} />
                    </a>
                )}

                {/* Amount */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    flexShrink: 0,
                    minWidth: "92px",
                }}>
                    <span style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color: isIncome ? "var(--success)" : twdValue >= 1000 ? "#f87171" : twdValue >= 500 ? "#fb923c" : "var(--text-primary)",
                        textAlign: "right",
                    }}>
                        {formattedAmount}
                    </span>
                    {twdSub && (
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textAlign: "right" }}>
                            {twdSub}
                        </span>
                    )}
                </div>

                {/* Actions (hover only) */}
                <div style={{
                    display: "flex",
                    gap: "4px",
                    opacity: hovered ? 1 : 0,
                    transition: "opacity 0.15s",
                    flexShrink: 0,
                }}>
                    <button
                        className="card-action-btn"
                        aria-label="Edit Entry"
                        onClick={() => setEditOpen(true)}
                        style={{ padding: "4px" }}
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        className="card-action-btn danger"
                        aria-label="Delete Entry"
                        onClick={() => setDeleteOpen(true)}
                        style={{ padding: "4px" }}
                    >
                        <Trash2 size={13} />
                    </button>
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
                label={entry.description ?? formattedAmount}
            />
        </>
    );
}
