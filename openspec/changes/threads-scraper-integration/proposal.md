## Why

原本的 `threads-scraper` 專案為一個獨立的 Python 工具，可以自動監控特定的 Threads 創作者、搜尋關鍵字，並提供 Discord、LINE 等通訊軟體的通知服務。
為了更深度整合個人的生活、財務與各種生產力系統（Kang-Core），將其整合進目前的 TypeScript + Next.js + Firestore 架構為最佳實踐。這不僅能讓我們在統一的 Dashboard 管理這些洞察數據，更可利用 Next.js API Routes 充當 Webhook Receiver，達到「單點儲存、統一發送」的效果。後續還可以針對抓取下來的內容執行 AI 分析或直接加入日曆/待辦事項中。

## What Changes

本變更將實現：

1. 作為微服務 (Microservice) 導入 `threads-scraper` 至 `services/threads-scraper/` 目錄。
2. 透過 Next.js App Router 實作 `POST /api/webhooks/threads`，負責接收從 Python 爬蟲送出的通知事件。
3. 把接收到的 Payload 進行 Zod Data Validation（符合我們定義的 `ThreadsEntrySchema`）。
4. 自動將通過驗證的資料寫入主庫 **Firestore**。
5. （進階應用）在 Server Action 整合使用既有的 LINE Bot 推送服務向用戶端發送通知。

## Capabilities

### New Capabilities

- `threads-microservice`: Python (Playwright + FastAPI) 背景微服務整合模組，負責資料搜集與觸發。
- `threads-webhook-receiver`: Next.js Webhook 端點，負責安全地接收、記錄及轉送爬蟲資訊至 Firestore 與指定服務。

### Modified Capabilities

- `schema-typing`: 已經修改過 `schema.ts`，新增了容納此功能的變更 (`ThreadsEntrySchema`, `ThreadsEntryView` 等)。

## Impact

1. **系統邊界擴展**：導入 Python 為基底的微服務，將增加 `Kang-Core` 除了 Node.js 以外的技術依賴（需使用 `uv` 管理）。
2. **通訊開銷**：爬蟲在觸發 Webhook 時，會對自家的 Next.js API Endpoint 產生 POST Request 請求與頻寬使用。
3. **Database**：這將建立一個名為 `entries` 或對應用途下的新 Collection Doc 分支，用來持久儲存蒐集的社群資料。
