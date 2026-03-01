# Design: 安全強化 + 生活功能擴充

## 架構影響分析

```
src/
├── app/api/
│   ├── webhook/line-bot/route.ts   ← 修改：加簽章驗證
│   ├── cron/
│   │   ├── daily-summary/route.ts  ← 修改：加預算警報邏輯
│   │   ├── diary-prompt/route.ts   ← 新增：晚間日記 cron
│   │   └── monthly-sheet/route.ts  ← 新增：月底 Sheets export
│   └── budget/route.ts             ← 新增：預算 CRUD API
├── services/
│   ├── message.service.ts          ← 修改：/問 & /完成 指令
│   ├── quickCommand.ts             ← 修改：加 /問、/完成、/洞察 userId
│   ├── classificationEngine.ts     ← 修改：輸入清理 + 快取
│   ├── insights.ts                 ← 修改：移除 default_user hardcode
│   └── richMenu.service.ts         ← 新增：Rich Menu 初始化
├── lib/
│   ├── gemini/parser.ts            ← 修改：/完成 新意圖類型
│   └── sheets/client.ts            ← 新增：Google Sheets client
└── utils/
    └── tagEmoji.ts                 ← 新增：統一 tagEmoji + tagLabel
```

## 各功能設計

### S1: Webhook 簽章驗證

- 使用 `@line/bot-sdk` 的 `validateSignature(rawBody, secret, signature)`
- Webhook route 改為先讀 `req.text()`，驗簽名再 `JSON.parse`
- 驗簽失敗回 403

### S2: Middleware Cookie 強化

- 移除 Middleware 中的 session 驗證邏輯（因 Edge Runtime 限制無法使用 Firebase Admin）
- 確保每個需要驗證的 API route 都有呼叫 `verifySessionCookie()`
- Middleware 僅負責 redirect 未登入用戶至 /login（現有行為較合理，記錄說明）

### S3: 洞察 userId 隔離

- `generateFinancialInsights()` 參數改用真實 `userId`（來自 `processEvent` 的 `event.source.userId`）
- `handleQuickInsight()` 接收 `userId` 參數並傳遞

### S4: processed_messages TTL 清理

- 新增 `/api/cron/cleanup-messages` cron，每週日 UTC 02:00 執行
- 刪除 7 天前的 `processed_messages` 文件

### S5: tagEmoji 統一

- 建立 `src/utils/tagEmoji.ts` 匯出 `tagEmoji()` 和 `tagLabel()`
- 替換 `quickCommand.ts`、`queryEngine.ts`、`daily-summary/route.ts` 中的重複定義

### S6: /記 觸發 ClassificationEngine.learn()

- `handleQuickExpense()` 成功後呼叫 `ClassificationEngine.learn(description, tag)`

### S7: ClassificationEngine 輸入清理 + 記憶體快取

- `learn()` 的 keyword 先做 sanitize（移除特殊字元）
- `match()` 加入模組級 `Map` 快取，TTL 5 分鐘

### F1: 預算超支警報

- 新增 `budgets` Firestore 集合：`{ userId, tag?, monthlyLimit, createdAt }`
- 新增 `/api/budget` GET/POST/DELETE
- 每次記帳後（`message.service.ts`）查詢當月同 tag 支出，若 >= 80% push 提醒
- 只在剛超門檻時提醒一次（用 Firestore 記錄 `budget_alerts` 當月是否已提醒）

### F2: Archive RAG 問答

- 快速指令 `/問 <問題>` → `handleArchiveQuery(question, userId)`
- 從 Firestore `archive` 集合取最近 50 筆
- 整理成文字 context 傳給 Gemini 做 RAG 問答
- 回傳相關摘要 + 原始連結（若有 url）

### F3: 待辦完成指令

- 快速指令 `/完成 <關鍵字>` → Firestore `calendar` 中搜尋 `status == pending` 且 `title` 包含關鍵字
- 找到則更新 `status = "done"`, `completedAt = now`
- 同步更新 Google Calendar 事件（若有 `gcalEventId`）

### F4: 晚間日記模式

- 新增 `/api/cron/diary-prompt` cron，每日 UTC 14:30（台灣 22:30）執行
- Push LINE 訊息：「🌙 今天有什麼值得記下來的？」
- 使用者回覆後，Gemini parser 的 system prompt 中新增脈絡判斷：
  若前一則機器人訊息是日記提示，且使用者回覆不像記帳/行事曆，則 type = "archive"（日記）
  → `archiveData.keywords` 中加入 `["diary", dateStr]`

### F5: 月底 Export Google Sheets

- 新增 `src/lib/sheets/client.ts` — Google Sheets API client（使用 Service Account）
- 新增 `/api/cron/monthly-sheet` cron，每月 UTC 15:00（台灣月底 23:00）執行
- 從 `accounting` 集合查當月所有資料，寫入 Google Sheet（新增或更新 tab）
- Push LINE 通知「📊 [月份] 帳目已匯出至 Google Sheets」

### F6: LINE Rich Menu

- 新增 `src/services/richMenu.service.ts` — 呼叫 LINE Messaging API 建立 Rich Menu
- 新增 `/api/admin/setup-richmenu` API（一次性手動觸發）
- Rich Menu 6 格設計：
  - 💰 快速記帳（/記）
  - 📊 查本月（/查 本月）
  - 📌 新增待辦（/待）
  - 🧠 AI 洞察（/洞察）
  - 📦 最新收藏（/查 archive）
  - ❓ 說明（/help）
