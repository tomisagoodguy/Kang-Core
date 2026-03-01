# 前端儀表板 Design

## 設計語言

- **主題**：深色模式 (Dark Mode)，底色 `#0f0f13`，強調色 `#7c3aed` (紫色)。
- **風格**：Glassmorphism（玻璃擬態）卡片，帶有微妙的 backdrop-blur 與光邊效果。
- **字型**：Google Fonts `Inter`，標題 600 weight，內文 400 weight。
- **圓角**：`12px` 標準，卡片統一使用。
- **動畫**：hover 時卡片微微上浮 (`translateY(-4px)`)，transition 300ms ease。

## 版面配置

### 共用 Layout (`layout.tsx`)

```
┌──────────────────────────────────────────────┐
│  🧠 Kang-Core           [記帳] [存檔] [首頁]  │  ← Navbar (sticky)
├──────────────────────────────────────────────┤
│                                              │
│                 <main>                       │
│                                              │
└──────────────────────────────────────────────┘
```

### 首頁 (`/`)

```
┌────────────┬────────────┬────────────┐
│ 本月總支出  │  本月筆數  │  存檔數量  │  ← StatCard × 3
└────────────┴────────────┴────────────┘

┌───────────────────┬──────────────────┐
│   最近 5 筆記帳   │   最近 5 筆存檔  │
│   AccountingCard  │   ArchiveCard    │
│   × 5            │   × 5           │
└───────────────────┴──────────────────┘
```

### 記帳列表頁 (`/accounting`)

```
┌──────────────────────────────────────────────┐
│  篩選: [全部分類 ▼]  [本月 ▼]                │
├──────────────────────────────────────────────┤
│  DATE       AMOUNT    TAG         描述       │
│  ─────────────────────────────────────────   │
│  2026-03-01  $470    Food      昨天吃百八    │
│  ...                                         │
└──────────────────────────────────────────────┘
```

### 存檔列表頁 (`/archive`)

```
┌──────────────────────────────────────────────┐
│  搜尋關鍵字: [________________]              │
├──────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐           │
│ │   ArchiveCard│  │  ArchiveCard │           │
│ │  title       │  │  title       │           │
│ │  summary...  │  │  summary...  │           │
│ │  #tag1 #tag2 │  │  #tag1       │           │
│ └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────┘
```

## 元件清單

| 元件名稱 | 路徑 | 說明 |
|---|---|---|
| `Navbar` | `src/components/Navbar.tsx` | 頂部導覽列 |
| `StatCard` | `src/components/StatCard.tsx` | 統計數字卡片 |
| `AccountingCard` | `src/components/AccountingCard.tsx` | 單筆記帳顯示 |
| `ArchiveCard` | `src/components/ArchiveCard.tsx` | 單筆存檔顯示 |
| `TagBadge` | `src/components/TagBadge.tsx` | 分類標籤顯示 |

## API Routes

| 路徑 | 方法 | 說明 |
|---|---|---|
| `/api/accounting` | GET | 讀取記帳記錄，支援 `?limit=`, `?tag=` |
| `/api/archive` | GET | 讀取存檔記錄，支援 `?limit=`, `?q=` |

## 色彩系統

```css
--bg-primary: #0f0f13;
--bg-glass: rgba(255, 255, 255, 0.05);
--border-glass: rgba(255, 255, 255, 0.1);
--accent: #7c3aed;
--accent-light: #a78bfa;
--text-primary: #f3f4f6;
--text-secondary: #9ca3af;
--tag-food: #f59e0b;
--tag-transport: #3b82f6;
--tag-entertainment: #ec4899;
--tag-utilities: #06b6d4;
--tag-shopping: #8b5cf6;
--tag-health: #10b981;
--tag-education: #f97316;
--tag-other: #6b7280;
```
