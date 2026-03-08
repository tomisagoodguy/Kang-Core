"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteConfirmProps {
    isOpen: boolean;
    onClose: () => void;
    entryId: string;
    collection: string;
    label?: string;
}

export function DeleteConfirm({ isOpen, onClose, entryId, collection, label }: DeleteConfirmProps) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/${collection}/${entryId}`, { method: "DELETE" });
            if (res.ok) {
                router.refresh();
                onClose();
            }
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)" }}>
                    <Trash2 size={20} /> 確認刪除
                </h3>
                <p className="modal-message">
                    確定要刪除{label ? ` "${label}" ` : "此條目"}嗎？此操作無法復原。
                </p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={deleting}>取消</button>
                    <button className="modal-btn modal-btn-danger" onClick={handleDelete} disabled={deleting}>
                        {deleting ? "刪除中..." : "確認刪除"}
                    </button>
                </div>
            </div>
        </div>
    );
}
