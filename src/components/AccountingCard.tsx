import { TagBadge } from "./TagBadge";

interface AccountingEntry {
    id: string;
    amount: number;
    tag: string;
    date: string;
    description?: string;
    originalText?: string;
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
            <span className="accounting-card-date">{entry.date}</span>
            <span className="accounting-card-desc">
                {entry.description || entry.originalText || "—"}
            </span>
            <TagBadge tag={entry.tag} />
            <span className={amountClass}>${formattedAmount}</span>
        </div>
    );
}
