'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArchiveCard } from "@/components/ArchiveCard";
import type { ArchiveEntryView } from "@/models/schema";

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

export default function ArchivePage() {
    const [entries, setEntries] = useState<ArchiveEntryView[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 300);

    const fetchEntries = useCallback(async (q: string) => {
        setLoading(true);
        // We fetch more here to give categorisation a good base, even for searches
        const url = q ? `/api/archive?limit=100&q=${encodeURIComponent(q)}` : "/api/archive?limit=100";
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            setEntries(data.entries ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchEntries(debouncedQuery);
        // Reset selected tag if a new explicit search is made? 
        // Or keep it to filter within search? Let's just keep it to filter within search.
    }, [debouncedQuery, fetchEntries]);

    // Extract top tags dynamically from the available entries
    const topTags = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(entry => {
            if (Array.isArray(entry.keywords)) {
                entry.keywords.forEach(kw => {
                    counts[kw] = (counts[kw] || 0) + 1;
                });
            }
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1]) // Sort by frequency
            .slice(0, 8)                 // Take top 8
            .map(t => t[0]);
    }, [entries]);

    // Group items for display
    const groupedEntries = useMemo(() => {
        const listToGroup = selectedTag
            ? entries.filter(e => Array.isArray(e.keywords) && e.keywords.includes(selectedTag))
            : entries;

        const groups: Record<string, ArchiveEntryView[]> = {};
        const others: ArchiveEntryView[] = [];

        listToGroup.forEach(entry => {
            let mainTag = "未分類";
            if (Array.isArray(entry.keywords) && entry.keywords.length > 0) {
                // Determine the primary tag to group this item under.
                // If a tag is selected, we group EVERYTHING under that selected tag.
                // Otherwise, group by its first keyword.
                mainTag = selectedTag ? selectedTag : entry.keywords[0];
            } else if (selectedTag) {
                mainTag = selectedTag;
            }

            if (!groups[mainTag]) {
                groups[mainTag] = [];
            }
            groups[mainTag].push(entry);
        });

        // Optional: move really small groups into "其他" if no tag is selected
        // But straight grouping is finer for now, keeps semantics intact.

        return Object.entries(groups).sort((a, b) => {
            if (a[0] === "未分類") return 1;
            if (b[0] === "未分類") return -1;
            return b[1].length - a[1].length;
        });
    }, [entries, selectedTag]);

    return (
        <div className="page-container">
            <h1 className="page-title">📚 知識存檔</h1>

            <div className="filter-bar" style={{ marginBottom: "16px" }}>
                <input
                    type="text"
                    className="filter-input"
                    placeholder="🔍 搜尋關鍵字、標題或摘要..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem", alignSelf: "center" }}>
                    {entries.length} 筆資料
                </span>
            </div>

            {/* Quick Filter Tabs */}
            {topTags.length > 0 && !loading && (
                <div className="category-tabs">
                    <button
                        className={`category-tab ${selectedTag === null ? "active" : ""}`}
                        onClick={() => setSelectedTag(null)}
                    >
                        全部 ({entries.length})
                    </button>
                    {topTags.map(tag => {
                        const count = entries.filter(e => Array.isArray(e.keywords) && e.keywords.includes(tag)).length;
                        return (
                            <button
                                key={tag}
                                className={`category-tab ${selectedTag === tag ? "active" : ""}`}
                                onClick={() => setSelectedTag(tag)}
                            >
                                {tag} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <p>{searchQuery ? `沒有找到「${searchQuery}」的相關存檔` : "還沒有存檔記錄，傳連結或文字給機器人！"}</p>
                </div>
            ) : groupedEntries.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">🏷️</span>
                    <p>這個標籤下沒有記錄，請選擇其他標籤。</p>
                </div>
            ) : (
                <div className="archive-grouped-list" style={{ display: "flex", flexDirection: "column", gap: "32px", paddingBottom: "40px" }}>
                    {groupedEntries.map(([groupName, groupItems]) => (
                        <div key={groupName} className="archive-section">
                            <h2 style={{
                                fontSize: "1.125rem",
                                marginBottom: "16px",
                                color: "var(--text-primary)",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                borderBottom: "1px solid var(--border-glass)",
                                paddingBottom: "12px"
                            }}>
                                📁 {groupName}
                                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontWeight: "normal" }}>
                                    ({groupItems.length})
                                </span>
                            </h2>
                            <div className="archive-grid">
                                {groupItems.map((entry) => (
                                    <ArchiveCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
