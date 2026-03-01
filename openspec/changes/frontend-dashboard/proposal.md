# 前端儀表板 Proposal

## 問題陳述

目前 Kang-Core 的 LINE Bot 已能透過自然語言接收記帳與知識庫儲存請求，並寫入 Firebase Firestore。然而，使用者目前完全無法查看已記錄的資料，必須另外登入 Firebase Console 才能看到原始資料，體驗極差。

## 目標

建立一個**精美的 Next.js 前端儀表板**，讓使用者可以：
1. 以視覺化方式查看所有記帳記錄（含分類、金額、日期）。
2. 以視覺化方式查看所有知識庫存檔（Archive）。
3. 看到基礎統計數字（本月支出、各分類佔比）。

## 非目標 (Non-goals)

- 不實作使用者驗證 (Authentication)，本次假設是個人使用的私人儀表板。
- 不實作新增/編輯/刪除記錄的功能（純顯示）。
- 不實作複雜的數據分析或 AI 功能（保留給後續 sprint）。

## 方案

### 頁面結構

- **`/` (首頁)**：儀表板首頁，顯示本月統計數字、最近記帳記錄、最近存檔。
- **`/accounting`**：完整記帳列表，支援依日期/分類篩選。
- **`/archive`**：完整知識庫列表，支援關鍵字搜尋。

### 技術方案

- **前端框架**：Next.js App Router（已有）+ Server Components（優先）。
- **資料來源**：Firebase Firestore Client SDK（`src/lib/firebase/client.ts`）透過 `onSnapshot` 實現即時更新。
- **樣式**：Vanilla CSS（`globals.css`），深色主題，玻璃擬態 (Glassmorphism) 卡片設計。
- **API Routes**：建立 `/api/accounting` 和 `/api/archive` 兩個 GET Endpoints，由 Admin SDK 讀取資料供 Server Component 使用（避免客戶端直接持有 Admin 憑證）。

## 成功指標

- 使用者可在儀表板上即時看到透過 LINE Bot 記錄的資料。
- 頁面在 Vercel 部署環境下可正常存取。
