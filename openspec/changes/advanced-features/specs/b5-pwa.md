# Spec B5: PWA (Progressive Web App)

## 概述

將 Next.js Dashboard 設定為 PWA，讓使用者可以安裝到手機桌面，像原生 App 一樣操作。

## 需要新增的檔案

### `public/manifest.json`

```json
{
  "name": "康 Core Dashboard",
  "short_name": "KangCore",
  "description": "個人智慧管家儀表板",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a12",
  "theme_color": "#7c3aed",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### `public/sw.js`

策略：Network-first with cache fallback。快取：

- 靜態資源（CSS/JS/字型）
- API 回應（短期快取 5 分鐘）

### Icons

- `public/icons/icon-192.png` — 192×192
- `public/icons/icon-512.png` — 512×512
- 使用 `generate_image` 生成或手動設計

## 前端改動

### `src/app/layout.tsx`

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#7c3aed" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### Service Worker 註冊

在 `layout.tsx` 的 `<script>` 或獨立 `sw-register.ts` 中：

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 離線體驗

- 離線時顯示最後一次載入的資料（快取版本）
- 離線 Banner：「目前離線，顯示的是快取資料」
