## Tasks

- [x] **Task 1**: 建立 CSS 設計系統
  - 更新 `src/app/globals.css`，加入色彩變數、Glassmorphism 卡片樣式、Navbar 樣式、StatCard、AccountingCard、ArchiveCard 所需的所有 CSS class。
  - 引入 Google Fonts Inter。

- [x] **Task 2**: 建立共用元件
  - 建立 `src/components/TagBadge.tsx`
  - 建立 `src/components/StatCard.tsx`
  - 建立 `src/components/AccountingCard.tsx`
  - 建立 `src/components/ArchiveCard.tsx`
  - 建立 `src/components/Navbar.tsx`

- [x] **Task 3**: 建立 API Route `/api/accounting`
  - 建立 `src/app/api/accounting/route.ts`
  - 使用 Firebase Admin SDK 讀取 `accounting` collection
  - 支援 `limit` 和 `tag` query 參數

- [x] **Task 4**: 建立 API Route `/api/archive`
  - 建立 `src/app/api/archive/route.ts`
  - 使用 Firebase Admin SDK 讀取 `archive` collection
  - 支援 `limit` 和 `q` query 參數（後端 filter keywords）

- [x] **Task 5**: 實作首頁 `/`
  - 更新 `src/app/page.tsx`（Server Component）
  - 呼叫兩個 API Routes 取得資料
  - 渲染 StatCards + 兩欄記帳/存檔預覽

- [x] **Task 6**: 實作記帳列表頁 `/accounting`
  - 建立 `src/app/accounting/page.tsx`（Client Component）
  - 包含 tag 和 month 篩選器
  - 完整記帳 AccountingCard 列表

- [x] **Task 7**: 實作存檔列表頁 `/archive`
  - 建立 `src/app/archive/page.tsx`（Client Component）
  - 包含關鍵字搜尋框（debounce 300ms）
  - ArchiveCard 兩欄 Grid

- [x] **Task 8**: 更新 Layout，加入 Navbar
  - 更新 `src/app/layout.tsx`，引入 Navbar 元件，設定頁面結構
