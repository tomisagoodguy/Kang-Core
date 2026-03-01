import { TagBadge } from "./TagBadge";

interface ArchiveEntry {
    id: string;
    summary: string;
    keywords: string[];
    url?: string;
    title?: string;
    imageUrl?: string;
    createdAt?: string;
}

interface ArchiveCardProps {
    entry: ArchiveEntry;
}

export function ArchiveCard({ entry }: ArchiveCardProps) {
    let displayTitle = entry.title || "知識存檔";
    if (!entry.title && entry.url) {
        try { displayTitle = new URL(entry.url).hostname; } catch { /* invalid URL */ }
    }
    // 不截斷摘要，由 CSS -webkit-line-clamp 控制顯示行數
    const summary = entry.summary;

    return (
        <div className="glass-card archive-card">
            {entry.imageUrl && (
                <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={entry.imageUrl}
                        alt="截圖"
                        style={{
                            width: "100%",
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 8,
                            marginBottom: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                        }}
                    />
                </a>
            )}
            <div className="archive-card-title" title={displayTitle}>
                {displayTitle}
            </div>
            <div className="archive-card-summary">{summary}</div>
            <div className="archive-card-keywords">
                {entry.keywords.slice(0, 4).map((kw) => (
                    <TagBadge key={kw} tag={kw} />
                ))}
            </div>
            {entry.url && (
                <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="archive-card-link"
                >
                    🔗 查看原始連結
                </a>
            )}
        </div>
    );
}
