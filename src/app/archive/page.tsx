'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArchiveCard } from "@/components/ArchiveCard";
import type { ArchiveEntryView } from "@/models/schema";
import { Search, BookOpen, Loader2, Inbox } from "lucide-react";

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
    }, [debouncedQuery, fetchEntries]);

    // Top keywords sorted by frequency
    const topTags = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(entry => {
            entry.keywords?.forEach(kw => {
                counts[kw] = (counts[kw] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(t => t[0]);
    }, [entries]);

    // Flat filtered list (no group-by-keyword confusion)
    const filtered = useMemo(() => {
        return selectedTag
            ? entries.filter(e => e.keywords?.includes(selectedTag))
            : entries;
    }, [entries, selectedTag]);

    const linkCount = useMemo(() => filtered.filter(e => !!e.url).length, [filtered]);
    const noteCount = useMemo(() => filtered.filter(e => !e.url).length, [filtered]);

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <BookOpen size={28} className="text-accent" />
                知識存檔
            </h1>

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
                <Search size={16} style={{
                    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                    color: "var(--text-muted)", pointerEvents: "none",
                }} />
                <input
                    type="text"
                    className="filter-input"
                    placeholder="搜尋關鍵字、標題或摘要..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: "40px", width: "100%", fontSize: "0.9375rem" }}
                />
            </div>

            {/* Stats row */}
            {!loading && entries.length > 0 && (
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    <span>共 <strong style={{ color: "var(--text-primary)" }}>{filtered.length}</strong> 筆</span>
                    {linkCount > 0 && <span>🔗 {linkCount} 個連結</span>}
                    {noteCount > 0 && <span>📝 {noteCount} 則筆記</span>}
                </div>
            )}

            {/* Keyword filter tabs */}
            {topTags.length > 0 && !loading && (
                <div className="category-tabs" style={{ marginBottom: "20px", overflowX: "auto", flexWrap: "nowrap" }}>
                    <button
                        className={`category-tab ${selectedTag === null ? "active" : ""}`}
                        onClick={() => setSelectedTag(null)}
                    >
                        全部
                    </button>
                    {topTags.map(tag => {
                        const count = entries.filter(e => e.keywords?.includes(tag)).length;
                        return (
                            <button
                                key={tag}
                                className={`category-tab ${selectedTag === tag ? "active" : ""}`}
                                onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
                            >
                                {tag}
                                <span style={{ marginLeft: "4px", opacity: 0.6, fontSize: "0.72rem" }}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Loader2 className="animate-spin text-accent" size={32} />
                    <p style={{ color: "var(--text-secondary)" }}>載入中...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Inbox size={48} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                    <p style={{ color: "var(--text-secondary)" }}>
                        {searchQuery ? `沒有找到「${searchQuery}」的相關存檔` : selectedTag ? `「${selectedTag}」下沒有記錄` : "還沒有存檔，傳連結或文字給機器人！"}
                    </p>
                </div>
            ) : (
                <div className="archive-grid" style={{ paddingBottom: "40px" }}>
                    {filtered.map((entry) => (
                        <ArchiveCard key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
