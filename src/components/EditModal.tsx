"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

interface FieldDef {
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "textarea";
}

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: Record<string, unknown>;
    collection: string;
    fields: FieldDef[];
}

export function EditModal({ isOpen, onClose, entry, collection, fields }: EditModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<Record<string, unknown>>(() => {
        const initial: Record<string, unknown> = {};
        fields.forEach((f) => {
            const val = entry[f.key];
            initial[f.key] = Array.isArray(val) ? (val as string[]).join(", ") : val ?? "";
        });
        return initial;
    });
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const body: Record<string, unknown> = {};
            fields.forEach((f) => {
                const val = formData[f.key];
                if (f.key === "keywords" && typeof val === "string") {
                    body[f.key] = val.split(",").map((s: string) => s.trim()).filter(Boolean);
                } else if (f.type === "number") {
                    body[f.key] = Number(val);
                } else {
                    body[f.key] = val;
                }
            });

            const res = await fetch(`/api/${collection}/${entry.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                router.refresh();
                onClose();
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Pencil size={20} /> 編輯
                </h3>
                <div className="modal-body">
                    {fields.map((f) => (
                        <div key={f.key} className="modal-field">
                            <label className="modal-label">{f.label}</label>
                            {f.type === "textarea" ? (
                                <textarea
                                    className="modal-input"
                                    rows={3}
                                    value={String(formData[f.key] ?? "")}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                />
                            ) : (
                                <input
                                    className="modal-input"
                                    type={f.type || "text"}
                                    value={String(formData[f.key] ?? "")}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={saving}>取消</button>
                    <button className="modal-btn modal-btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? "儲存中..." : "儲存"}
                    </button>
                </div>
            </div>
        </div>
    );
}
