'use client';

import { useState, useEffect } from "react";
import { PARENT_TAGS } from "@/utils/constants";
import type { CustomTagView } from "@/models/schema";


export default function SettingsTagsPage() {
    const [tags, setTags] = useState<CustomTagView[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CustomTagView | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [parentTag, setParentTag] = useState("Other");

    const fetchTags = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/tags");
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const handleOpenModal = (item?: CustomTagView) => {
        if (item) {
            setEditingItem(item);
            setName(item.name);
            setParentTag(item.parentTag);
        } else {
            setEditingItem(null);
            setName("");
            setParentTag("Other");
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name) return alert("請輸入標籤名稱");

        const data: Partial<CustomTagView> = {
            name,
            parentTag,
        };

        try {
            const url = editingItem ? `/api/tags/${editingItem.id}` : "/api/tags";
            const method = editingItem ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchTags();
            } else {
                alert("儲存失敗");
            }
        } catch (err) {
            alert("Error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除此標籤嗎？")) return;
        try {
            await fetch(`/api/tags/${id}`, { method: "DELETE" });
            fetchTags();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="page-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className="page-title">⚙️ 標籤管理 (子分類)</h1>
                <button
                    onClick={() => handleOpenModal()}
                    style={{
                        padding: "8px 16px",
                        background: "var(--primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "600",
                        cursor: "pointer"
                    }}
                >
                    ＋ 新增子標籤
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <span className="empty-state-icon">⏳</span>
                    <p>載入中...</p>
                </div>
            ) : tags.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">🏷️</span>
                    <p>尚未建立自訂標籤</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "12px", marginTop: "24px" }}>
                    {PARENT_TAGS.map(p => {
                        const subTags = tags.filter(t => t.parentTag === p);
                        if (subTags.length === 0) return null;
                        return (
                            <div key={p} style={{ background: "var(--card-bg)", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 12px var(--shadow-color)" }}>
                                <h3 style={{ marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>{p}</h3>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {subTags.map(t => (
                                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-color)", padding: "4px 12px", borderRadius: "20px", border: "1px solid var(--border-color)" }}>
                                            <span>{t.name}</span>
                                            <button onClick={() => handleOpenModal(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}>✏️</button>
                                            <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--danger)" }}>🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--card-bg)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "400px",
                        boxShadow: "0 8px 32px var(--shadow-color)"
                    }}>
                        <h2 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>{editingItem ? "編輯子標籤" : "新增子標籤"}</h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="text"
                                placeholder="子標籤名稱 (例如: 午餐)"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            />

                            <select
                                value={parentTag}
                                onChange={e => setParentTag(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }}
                            >
                                {PARENT_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "white", fontWeight: "600", cursor: "pointer" }}
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
