'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { ThreadsCard } from "@/components/ThreadsCard";
import type { ThreadsEntryView } from "@/models/schema";
import { MessageCircle, Search, Inbox, Tag, LoaderCircle, Settings2, X, Plus, AtSign } from "lucide-react";

interface TrackingLists {
    users: { username: string }[];
    topics: { keyword: string }[];
}

function TrackingManager() {
    const [lists, setLists] = useState<TrackingLists>({ users: [], topics: [] });
    const [loading, setLoading] = useState(true);
    const [authorInput, setAuthorInput] = useState("");
    const [topicInput, setTopicInput] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const fetchLists = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/threads/tracking");
            if (res.ok) setLists(await res.json());
        } catch (error) {
            console.error("Failed to fetch tracking lists:", error);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchLists(); }, [fetchLists]);

    const handleAdd = async (type: "author" | "topic", value: string) => {
        if (!value.trim() || submitting) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/threads/tracking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, value }),
            });
            if (res.ok) {
                if (type === "author") setAuthorInput(""); else setTopicInput("");
                await fetchLists();
            } else {
                const data = await res.json().catch(() => ({}));
                alert("新增失敗：" + (data.error ?? "未知錯誤"));
            }
        } catch (error) {
            console.error("Failed to add tracking target:", error);
        }
        setSubmitting(false);
    };

    const handleRemove = async (type: "author" | "topic", value: string) => {
        try {
            const res = await fetch(`/api/threads/tracking?type=${type}&value=${encodeURIComponent(value)}`, {
                method: "DELETE",
            });
            if (res.ok) await fetchLists();
        } catch (error) {
            console.error("Failed to remove tracking target:", error);
        }
    };

    const chipStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "var(--bg-glass)",
        border: "1px solid var(--border-glass)",
        borderRadius: "999px",
        padding: "5px 8px 5px 12px",
        fontSize: "0.8125rem",
        color: "var(--text-secondary)",
    };

    return (
        <div className="glass-card" style={{ padding: "20px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
                    <AtSign size={16} /> 追蹤作者
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleAdd("author", authorInput); }}
                    style={{ display: "flex", gap: "8px", marginBottom: "10px" }}
                >
                    <input
                        type="text"
                        className="filter-input"
                        placeholder="輸入 Threads 帳號，例：hogan.tech"
                        value={authorInput}
                        onChange={(e) => setAuthorInput(e.target.value)}
                    />
                    <button type="submit" className="modal-btn modal-btn-save" disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                        <Plus size={16} /> 新增
                    </button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {lists.users.map((u) => (
                        <span key={u.username} style={chipStyle}>
                            @{u.username}
                            <button onClick={() => handleRemove("author", u.username)} title="取消追蹤" style={{ display: "flex", color: "var(--text-muted)", cursor: "pointer" }}>
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                    {!loading && lists.users.length === 0 && (
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>尚未追蹤任何帳號</span>
                    )}
                </div>
            </div>

            <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
                    <Tag size={16} /> 追蹤主題
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleAdd("topic", topicInput); }}
                    style={{ display: "flex", gap: "8px", marginBottom: "10px" }}
                >
                    <input
                        type="text"
                        className="filter-input"
                        placeholder="輸入關鍵字，例：台股"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                    />
                    <button type="submit" className="modal-btn modal-btn-save" disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                        <Plus size={16} /> 新增
                    </button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {lists.topics.map((t) => (
                        <span key={t.keyword} style={chipStyle}>
                            {t.keyword}
                            <button onClick={() => handleRemove("topic", t.keyword)} title="取消追蹤" style={{ display: "flex", color: "var(--text-muted)", cursor: "pointer" }}>
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                    {!loading && lists.topics.length === 0 && (
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>尚未追蹤任何主題</span>
                    )}
                </div>
            </div>
        </div>
    );
}

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
    const [showTrackingManager, setShowTrackingManager] = useState(false);
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
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", gap: '8px' }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MessageCircle size={28} className="text-accent" />
                    社群洞察
                </span>
                <button
                    className="modal-btn modal-btn-cancel"
                    onClick={() => setShowTrackingManager(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem" }}
                >
                    <Settings2 size={16} /> 追蹤管理
                </button>
            </h1>

            {showTrackingManager && <TrackingManager />}

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
                <div className="threads-grid" style={{ paddingBottom: "40px" }}>
                    {filteredEntries.map((entry) => (
                        <ThreadsCard key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
