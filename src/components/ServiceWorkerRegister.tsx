'use client';

import { useEffect, useState } from "react";

/**
 * 註冊 PWA Service Worker（public/sw.js），啟用離線瀏覽與靜態資源快取。
 * 偵測到新版本 SW 時顯示更新提示，避免使用者卡在舊版快取。
 */
export function ServiceWorkerRegister() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker.register("/sw.js").then((registration) => {
            if (registration.waiting) {
                setWaitingWorker(registration.waiting);
                setUpdateAvailable(true);
            }
            registration.addEventListener("updatefound", () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        setWaitingWorker(newWorker);
                        setUpdateAvailable(true);
                    }
                });
            });
        }).catch((err) => console.warn("[SW] 註冊失敗:", err));

        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
        });
    }, []);

    const handleUpdate = () => {
        waitingWorker?.postMessage({ type: "SKIP_WAITING" });
        setUpdateAvailable(false);
    };

    if (!updateAvailable) return null;

    return (
        <div style={{
            position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)",
            background: "var(--primary)", color: "white", padding: "10px 20px", borderRadius: "10px",
            display: "flex", alignItems: "center", gap: "12px", zIndex: 2000, boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            fontSize: "0.85rem",
        }}>
            🆕 有新版本可用
            <button
                onClick={handleUpdate}
                style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: "white", color: "var(--primary)", fontWeight: 600, cursor: "pointer" }}
            >
                立即更新
            </button>
        </div>
    );
}
