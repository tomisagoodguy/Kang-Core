# Spec B6: 深色 / 淺色模式切換

## 概述

目前只有深色主題。新增淺色主題，並讓使用者自由切換，預設跟隨系統偏好。

## CSS 變數分組

### `globals.css`

```css
/* 深色主題（預設） */
:root, [data-theme="dark"] {
  --bg-primary: #0a0a12;
  --bg-secondary: #12121c;
  --bg-glass: rgba(255, 255, 255, 0.04);
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --border-glass: rgba(255, 255, 255, 0.08);
  /* ... 其他現有變數 */
}

/* 淺色主題 */
[data-theme="light"] {
  --bg-primary: #f8f9fc;
  --bg-secondary: #ffffff;
  --bg-glass: rgba(0, 0, 0, 0.03);
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --border-glass: rgba(0, 0, 0, 0.08);
  --accent: #7c3aed;
  --accent-light: #a78bfa;
  --danger: #ef4444;
}
```

## 切換邏輯

### `src/components/ThemeToggle.tsx`

1. 讀取 `localStorage.getItem("theme")`
2. 若無 → 跟隨 `window.matchMedia("(prefers-color-scheme: dark)")`
3. 切換時更新 `document.documentElement.setAttribute("data-theme", theme)`
4. 儲存到 `localStorage`

### 按鈕位置

Navbar 右側，在登出按鈕左邊。使用 🌙 / ☀️ icon。

## 防閃爍

在 `layout.tsx` 的 `<head>` 中加入 blocking script：

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

這確保 HTML 渲染前就套用正確主題，避免白色閃爍。
