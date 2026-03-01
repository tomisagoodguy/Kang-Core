# Tasks: 安全強化 + 生活功能擴充

## Batch S — 安全修復（P0 先行）

### S1: Webhook 簽章驗證

- [x] 1. 修改 `src/app/api/webhook/line-bot/route.ts` — 改為 `req.text()` + `validateSignature` 驗簽，失敗回 403

### S2: Middleware Cookie 說明強化

- [x] 2. 在 `src/middleware.ts` 加入清楚的說明註解，並確認 `/api/auth` 路由有完整的 Firebase session 驗證

### S3: 洞察 userId 隔離

- [x] 3. 修改 `src/services/insights.ts` — 移除 `default_user` hardcode，參數必填
- [x] 4. 修改 `src/services/quickCommand.ts` — `handleQuickInsight()` 接收 `userId` 並傳遞
- [x] 5. 修改 `src/services/message.service.ts` — `parseQuickCommand()` 傳入 `userId`

### S4: processed_messages TTL 清理

- [x] 6. 新增 `src/app/api/cron/cleanup-messages/route.ts` — 刪除 7 天前文件
- [x] 7. 更新 `vercel.json` — 新增 cron schedule（每週日 UTC 02:00）

### S5: tagEmoji 統一

- [x] 8. 新增 `src/utils/tagEmoji.ts` — 匯出 `getTagEmoji()` 和 `getTagLabel()`
- [x] 9. 修改 `src/services/quickCommand.ts` — 替換本地 `tagEmoji()`
- [x] 10. 修改 `src/services/queryEngine.ts` — 替換本地 `tagEmoji()`
- [x] 11. 修改 `src/app/api/cron/daily-summary/route.ts` — 替換本地 `tagEmoji` Record

### S6: /記 觸發 ClassificationEngine.learn()

- [x] 12. 修改 `src/services/quickCommand.ts` — `handleQuickExpense()` 成功後呼叫 `ClassificationEngine.learn()`

### S7: ClassificationEngine 輸入清理 + 記憶體快取

- [x] 13. 修改 `src/services/classificationEngine.ts` — `learn()` 加入 keyword sanitize（移除特殊字元，長度限制 20 字）
- [x] 14. 修改 `src/services/classificationEngine.ts` — `match()` 加入模組級 `Map` 快取（TTL 5 分鐘）

---

## Batch F — 新功能

### F1: 預算超支警報

- [x] 15. 新增 `src/app/api/budget/route.ts` — GET（查詢預算）/ POST（設定預算）/ DELETE（刪除預算）
- [x] 16. 新增 `src/services/budget.service.ts` — `checkBudgetAlert(userId, tag, amount, date)` 邏輯
- [x] 17. 修改 `src/services/message.service.ts` — 記帳成功後呼叫 `checkBudgetAlert()`
- [x] 18. 新增 `/預算 設定 <金額>` 指令到 `quickCommand.ts`（設定當月總預算）
- [x] 19. 新增 `/預算` 指令到 `quickCommand.ts`（查看當月預算使用狀況）
- [x] 20. 更新 `quickCommand.ts` 的 `/help` 說明文字

### F2: Archive RAG 問答

- [x] 21. 新增 `src/services/archiveQuery.service.ts` — `queryArchiveWithAI(question, userId)` RAG 實作
- [x] 22. 新增 `/問 <問題>` 指令到 `quickCommand.ts` — 呼叫 `archiveQuery.service`
- [x] 23. 更新 `quickCommand.ts` 的 `/help` 說明文字

### F3: 待辦完成指令

- [x] 24. 新增 `src/services/todoComplete.service.ts` — `completeTodo(keyword, userId)` 邏輯（Firestore 搜尋 + 更新）
- [x] 25. 新增 `/完成 <關鍵字>` 指令到 `quickCommand.ts`
- [x] 26. 更新 `quickCommand.ts` 的 `/help` 說明文字

### F4: 晚間日記模式

- [x] 27. 新增 `src/app/api/cron/diary-prompt/route.ts` — Push 日記提示訊息
- [x] 28. 更新 `vercel.json` — 新增 cron schedule（每日 UTC 14:30，台灣 22:30）

### F5: 月底 Export Google Sheets

- [x] 29. 新增 `src/lib/sheets/client.ts` — Google Sheets API client（googleapis，Service Account）
- [x] 30. 新增 `src/app/api/cron/monthly-sheet/route.ts` — 月底 cron，查詢當月帳目並寫入 Sheets + push LINE
- [x] 31. 更新 `vercel.json` — 新增 cron schedule（每月 28-31 日 UTC 15:00）
- [x] 32. `googleapis` 套件已安裝

### F6: LINE Rich Menu

- [x] 33. 新增 `src/services/richMenu.service.ts` — 定義 6 格 Rich Menu 結構 + 呼叫 LINE API 建立
- [x] 34. 新增 `src/app/api/admin/setup-richmenu/route.ts` — 一次性手動觸發端點（需 CRON_SECRET 驗證）

---

## 驗收

- [x] 35. `yarn build` 無錯誤 ✅
- [x] 36. Webhook 簽章驗證：用錯誤 secret 呼叫 Webhook 返回 403
- [x] 37. tagEmoji 統一，無重複定義
- [x] 38. /記 觸發 ClassificationEngine 學習
- [x] 39. 所有新 cron 端點有 CRON_SECRET 驗證
