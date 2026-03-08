'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { ThreadsCard } from "@/components/ThreadsCard";
import type { ThreadsEntryView } from "@/models/schema";
import { MessageCircle, Search, Inbox, Tag, LoaderCircle } from "lucide-react";

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

export default function ThreadsPage() {
    const [entries, setEntries] = useState<ThreadsEntryView[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 300);

    const fetchEntries = useCallback(async (q: string) => {
        setLoading(true);
        const url = q ? `/api/threads?limit=100&q=${encodeURIComponent(q)}` : "/api/threads?limit=100";
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries ?? []);
            }
        } catch (error) {
            console.error("Failed to fetch threads:", error);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchEntries(debouncedQuery);
    }, [debouncedQuery, fetchEntries]);

    // Extract top authors
    const topAuthors = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(entry => {
            if (entry.author) {
                counts[entry.author] = (counts[entry.author] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1]) // Sort by frequency
            .slice(0, 8)                 // Take top 8
            .map(t => t[0]);
    }, [entries]);

    // Group items for display
    const filteredEntries = useMemo(() => {
        return selectedAuthor
            ? entries.filter(e => e.author === selectedAuthor)
            : entries;
    }, [entries, selectedAuthor]);

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={28} className="text-accent" />
                社群洞察
            </h1>

            <div className="filter-bar" style={{ marginBottom: "16px", position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                    type="text"
                    className="filter-input"
                    placeholder="搜尋內容或作者..."
                    style={{ paddingLeft: "40px" }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem", alignSelf: "center" }}>
                    {entries.length} 筆貼文
                </span>
            </div>

            {/* Quick Filter Tabs for Authors */}
            {topAuthors.length > 0 && !loading && (
                <div className="category-tabs">
                    <button
                        className={`category-tab ${selectedAuthor === null ? "active" : ""}`}
                        onClick={() => setSelectedAuthor(null)}
                    >
                        全部 ({entries.length})
                    </button>
                    {topAuthors.map(author => {
                        const count = entries.filter(e => e.author === author).length;
                        return (
                            <button
                                key={author}
                                className={`category-tab ${selectedAuthor === author ? "active" : ""}`}
                                onClick={() => setSelectedAuthor(author)}
                            >
                                @{author} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <div className="empty-state">
                    <LoaderCircle size={48} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--accent)" }} />
                    <p>載入中...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="empty-state">
                    <Inbox size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                    <p>{searchQuery ? `沒有找到「${searchQuery}」的相關貼文` : "還沒有採集到任何 Threads 貼文！"}</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="empty-state">
                    <Tag size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                    <p>這位作者下沒有記錄，請選擇其他作者。</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", paddingBottom: "40px" }}>
                    {filteredEntries.map((entry) => (
                        <ThreadsCard key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
