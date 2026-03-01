# Proposal: 巨石代碼解耦 (Refactor LINE Bot Webhook)

## 問題描述 (Problem)

目前系統中存在巨石代碼 (Monolith Code)。具體如下：

1. `src/app/api/webhook/line-bot/route.ts`（長達 240+ 行，大小接近 10KB），這支 API 路由檔案不僅處理 HTTP 請求，還包含了大量的業務邏輯，包括：文字訊息處理、接收圖片並上傳至 Google Drive、使用 Gemini 解析圖片或文件、更新 Firebase、呼叫 Discord Webhook 等多項職責。完全違反 單一職責原則 (SRP)。
2. `src/lib/gemini/parser.ts` 雖然是共用工具，但負擔了決定如何分析、調用不同模型的複雜邏輯，且與業務資料庫模型緊密綁定。

## 目標 (Goals)

1. **解耦業務邏輯與 API 路由**：將 `route.ts` 內的處理邏輯抽出至 `services/` 目錄。
2. **遵守架構設計原則**：依循 Data-First 與分層設計，確保 `api/` 只有 Endpoint 路由功能，核心邏輯應在 `services/` 內。

## 解決方案提議 (Proposed Solution)

1. 建立 `src/services/lineWebhook.service.ts` 負責串接與分派 LINE Event。
2. 建立 `src/services/media.service.ts` (從 `route.ts` 抽離 Google Drive 上傳相關邏輯)。
3. 重構 `src/app/api/webhook/line-bot/route.ts` 使其只留接收請求與基本錯誤捕捉，其餘交由 Service 處理。

## 範圍 (Scope)

- 影響檔案：`src/app/api/webhook/line-bot/route.ts` 等。
- 新增檔案：`src/services/` 底下的相關 service 檔案。
