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
            <span className={amountClass}>${formattedAmount}</span>
        </div>
    );
}
