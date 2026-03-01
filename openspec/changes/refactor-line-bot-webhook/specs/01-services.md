# Spec 01: Service 解耦

## 目標

建立三個獨立的基礎 Service：`line.service.ts`, `drive.service.ts`, `discord.service.ts`。建立核心的 `message.service.ts`。

## 詳細規格

### 1. `src/services/line.service.ts`

- 封裝 `@line/bot-sdk`。
- 實作 `initClient` (若尚未初始化則建立)。
- 提供 `replyText(replyToken, text)`, `getMessageContentBuffer(messageId)` 等方法。

### 2. `src/services/drive.service.ts`

- 從 `src/app/api/webhook/line-bot/route.ts` 將 `uploadToDrive` 的實作移過去。
- 參數介面為 `(fileName: string, mimeType: string, buffer: Buffer)` 或 `Stream`。
- 回傳 Google Drive 檔案 URL。

### 3. `src/services/discord.service.ts`

- 建立 `sendDiscordNotification(message: string)` 函數。
- 將讀取 `DISCORD_WEBHOOK_URL` 並呼叫 `fetch` 的邏輯集中。

### 4. `src/services/message.service.ts`

- 實作 `processEvent(event: WebhookEvent)`
- 分流實作：`handleTextMessage`, `handleImageMessage`, `handleFileMessage`。
- 調用各項服務與 `src/lib/gemini/parser.ts` 及 `vision.ts` 相關邏輯。處理結果後，將紀錄儲存到 Firebase(`db.collection(...)`)。

### 5. `src/app/api/webhook/line-bot/route.ts`

- 精簡化，只保留 `POST(req)`，使用 `crypto` 或 LINE SDK 驗證簽章，提取 `events`，將 `event` 傳給 `MessageService.processEvent`。
