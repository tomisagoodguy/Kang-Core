# Spec: 前端儀表板

## 1. API Routes

### GET `/api/accounting`

**QueryParams**:
- `limit`: number（預設 20）
- `tag`: string（可選，篩選分類）

**Response (200)**:
```json
{
  "entries": [
    {
      "id": "firestore_doc_id",
      "amount": 470,
      "tag": "Food",
      "date": "2026-03-01",
      "description": "昨天吃百八",
      "originalText": "昨天吃百八花了470",
      "createdAt": "2026-03-01T04:00:00.000Z"
    }
  ],
  "total": 42
}
```

**實作要求**:
- 使用 Firebase Admin SDK (`src/lib/firebase/admin.ts`) 讀取資料。
- 依 `createdAt` 降序排列。
- `createdAt` 的 Firestore Timestamp 轉為 ISO String 輸出。

---

### GET `/api/archive`

**QueryParams**:
- `limit`: number（預設 20）
- `q`: string（可選，關鍵字搜尋，匹配 title 或 keywords 陣列）

**Response (200)**:
```json
{
  "entries": [
    {
      "id": "firestore_doc_id",
      "summary": "這是一個有趣的文章",
      "keywords": ["AI", "技術"],
      "url": "https://example.com",
      "title": "文章標題",
      "createdAt": "2026-03-01T04:00:00.000Z"
    }
  ],
  "total": 10
}
```

**實作要求**:
- 使用 Firebase Admin SDK 讀取資料。
- 依 `createdAt` 降序排列。
- 若有 `q` 參數，在後端過濾 (filter) `keywords` 陣列包含該字串的記錄。

---

## 2. 元件規格

### `TagBadge`
- Props: `tag: string`
- 依 `tag` 對應顯示對應顏色的圓角標籤。
- 使用 CSS 變數 `--tag-{lowercase tag}` 控制顏色。

### `AccountingCard`
- Props: `entry: AccountingEntry & { id: string }`
- 顯示：日期、金額（粗體，緑色/橘色對比色）、`TagBadge`、描述。
- 金額超過 1000 顯示紅色。

### `ArchiveCard`
- Props: `entry: ArchiveEntry & { id: string }`
- 顯示：標題、摘要（最多 80 字元，超過截斷）、關鍵字（`TagBadge` 列表）、來源 URL 連結。

### `StatCard`
- Props: `label: string; value: string | number; icon: string; color?: string`
- 顯示大數字 + 標籤。

### `Navbar`
- 左側：Logo (`🧠 康 Core`)
- 右側：三個導覽連結（首頁、記帳、存檔）。
- 使用 Next.js `Link` 元件，active 狀態用 `usePathname()` 判斷，加上底線動畫。

---

## 3. 頁面規格

### 首頁 `/`（Server Component）

1. 呼叫 `/api/accounting?limit=5` 和 `/api/archive?limit=5` 取得資料。
2. 計算本月合計金額（從 entries 過濾 date 開頭為當月）。
3. 渲染三個 `StatCard`。
4. 渲染兩欄：左邊 5 筆 `AccountingCard`，右邊 5 筆 `ArchiveCard`。

### 記帳列表 `/accounting`（Client Component，已使用 `'use client'`）

1. 從 `useState` 管理 `tag` 和 `month` 篩選條件。
2. 從 `/api/accounting` 取得完整列表。
3. 前端過濾 tag 和 month。
4. 渲染 `<select>` 篩選器 + 記帳列表（`AccountingCard` 列表）。

### 存檔列表 `/archive`（Client Component）

1. 從 `useState` 管理搜尋關鍵字。
2. 搜尋字串帶入 `/api/archive?q={keyword}` 查詢（用 debounce 300ms）。
3. 渲染搜尋框 + 卡片網格（兩欄 grid layout）。
