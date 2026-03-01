"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TagBadge } from "./TagBadge";

interface AccountingEntry {
    id: string;
    amount: number;
    tag: string;
    date: string;
    description?: string;
    originalText?: string;
    imageUrl?: string;
    createdAt?: string;
}

interface AccountingCardProps {
    entry: AccountingEntry;
}

export function AccountingCard({ entry }: AccountingCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("確定要刪除這筆記帳嗎？")) return;
        setIsDeleting(true);
        try {
            await fetch(`/api/accounting/${entry.id}`, { method: "DELETE" });
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("刪除失敗");
            setIsDeleting(false);
        }
    };

    const amountClass =
        entry.amount >= 1000
            ? "accounting-card-amount high"
            : entry.amount >= 500
                ? "accounting-card-amount medium"
                : "accounting-card-amount low";

    const formattedAmount = entry.amount.toLocaleString();

    return (
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
            <TagBadge tag={entry.tag} />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
                <span className={amountClass} style={{ marginLeft: 0 }}>${formattedAmount}</span>
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
                    title="刪除這筆資料"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}
