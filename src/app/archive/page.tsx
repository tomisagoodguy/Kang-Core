'use client';

import { useState, useEffect, useCallback } from "react";
import { ArchiveCard } from "@/components/ArchiveCard";

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

export default function ArchivePage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedQuery = useDebounce(searchQuery, 300);

    const fetchEntries = useCallback(async (q: string) => {
        setLoading(true);
        const url = q ? `/api/archive?limit=50&q=${encodeURIComponent(q)}` : "/api/archive?limit=50";
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

    return (
        <div className="page-container">
            <h1 className="page-title">📚 知識存檔</h1>

            <div className="filter-bar">
                <input
                    type="text"
                    className="filter-input"
                    placeholder="🔍 搜尋關鍵字、標題或摘要..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem", alignSelf: "center" }}>
                    {entries.length} 筆結果
                </span>
            </div>

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
            ) : (
                <div className="archive-grid">
                    {entries.map((entry) => (
                        <ArchiveCard key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
