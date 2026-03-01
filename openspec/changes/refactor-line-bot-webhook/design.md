# Design: LINE Bot Webhook 解耦

## 系統元件 (System Components)

目前的 `src/app/api/webhook/line-bot/route.ts` 將依據領域驅動設計概念拆分為不同的 Service：

1. **API Endpoint (`src/app/api/webhook/line-bot/route.ts`)**
   - 僅負責接收請求、驗證簽章。
   - 迭代 Webhook 事件並分派給 `MessageService`。
   - 捕捉全域錯誤。

2. **核心業務邏輯 (`src/services/message.service.ts`)**
   - 依據訊息類型 (`image`, `text`, `file`) 決定呼叫相應的處理邏輯。
   - 整合 parser 邏輯，並直接操作資料結構。
   - 主要入口為 `processEvent(event)`。

3. **基礎整合服務 (Infrastructure Services)**
   - `src/services/line.service.ts`: 提供包裝好的 LINE `client` 初始化、取得訊息內容 (`getMessageContentAsStream`)、以及傳送回覆訊息 (`replyMessage`) 的封裝。
   - `src/services/drive.service.ts`: 封裝上傳檔案到 Google Drive 的邏輯 (`uploadToDrive`)。
   - `src/services/discord.service.ts`: 封裝發送到 Discord Webhook 的邏輯 (`sendDiscordNotification`)。
   - `src/services/firestore.service.ts` 或直接在 `MessageService` 呼叫 DAO，以便對 Firebase API 進行簡化。

## 解決方案架構與資料流 (Architecture & Data Flow)

- LINE HTTP Request -> `api/webhook/line-bot` -> `line.service.ts` (簽章驗證)
- `api/webhook/line-bot` -> `MessageService.processEvent(event)`
- `MessageService` 依據 `event.type` 流程：
  - Text: `Gemini Parser` -> `DB` -> `LINE Reply` & `Discord`
  - Image: `LINE Service` (取得實體) -> `Drive Service` (儲存) -> `Gemini Vision` (解析) -> `DB` -> `LINE Reply` & `Discord`
