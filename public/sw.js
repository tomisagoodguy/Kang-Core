// 康 Core PWA Service Worker
// 快取策略：/_next/static 與圖片走 cache-first（檔名帶 hash，內容不變）；
// 頁面走 network-first（保證資料新鮮，離線時退回快取的殼／offline.html）；
// /api/ 一律不攔截，直接走網路，避免快取到過期或跨用戶的資料。
//
// 每次調整快取邏輯務必更新 CACHE_VERSION：檔案內容變動會讓瀏覽器偵測到新 SW 版本，
// 觸發 install → activate，並在 activate 時清掉舊版本快取。
const CACHE_VERSION = "v1";
const CACHE_NAME = `kang-core-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
    OFFLINE_URL,
    "/manifest.json",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    // 不自動 skipWaiting：讓新版本停在 waiting 狀態，等使用者在更新提示按下「立即更新」
    // 才透過 SKIP_WAITING 訊息啟用，避免正在使用中的頁面被無預警換版本
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // 外部資源（Firebase/Gemini 等）不攔截
    if (url.pathname.startsWith("/api/")) return; // API 一律走網路，不快取

    // 頁面導覽：network-first，離線時退回快取頁面或 offline.html
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
                )
        );
        return;
    }

    // 靜態資源（JS/CSS/字型/圖片）：cache-first，檔名帶 hash 可長期快取
    if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
    }
});
