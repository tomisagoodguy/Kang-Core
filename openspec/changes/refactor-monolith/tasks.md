# Tasks: 巨石代碼拆解重構

## Batch A — 核心拆解

### R1: MessageService 拆解

- [ ] 1. 建立 `src/services/handlers/` 目錄與 `MessageHandler` interface (`src/models/handler.ts`)
- [ ] 2. 抽出 `AccountingHandler`：從 `handleTextMessage()` L86-138 提取記帳意圖處理
- [ ] 3. 抽出 `ArchiveHandler`：合併文字 (L140-166) 與圖片 (L285-310) 的 archive 保存邏輯
- [ ] 4. 抽出 `CalendarHandler`：從 `handleTextMessage()` L168-197 提取行事曆意圖處理
- [ ] 5. 抽出 `RecurringHandler`：從 `handleTextMessage()` L199-217 提取定期支出處理
- [ ] 6. 抽出 `QueryHandler`：從 `handleTextMessage()` L219-221 提取查詢分派
- [ ] 7. 抽出 `ImageHandler`：重構 `handleImageMessage()` + `handleFileMessage()` → 共用 handler
- [ ] 8. 重構 `MessageService`：精簡為事件路由層 (~80 行)，委派到各 Handler

### R2: 共用層建立

- [ ] 9. 建立 `src/utils/constants.ts`：將 `ALL_TAGS` 從 3 個頁面統一到此處，導出 `TagName` type
- [ ] 10. 建立 `src/utils/dateRange.ts`：合併 `quickCommand.ts/parsePeriod()` 與 `queryEngine.ts/resolvePeriod()`
- [ ] 11. 建立 `src/models/accounting.ts`：統一 `AccountingEntry` interface
- [ ] 12. 建立 `src/models/archive.ts`：統一 `ArchiveEntry` interface（含 embedding 欄位）
- [ ] 13. 建立 `src/models/calendar.ts`：統一 `CalendarEntry` interface
- [ ] 14. 建立 `src/models/recurring.ts`：統一 `RecurringExpense` interface
- [ ] 15. 建立 `src/models/tags.ts`：統一 `CustomTag` interface
- [ ] 16. 更新所有頁面及服務 import：使用統一 models 取代各自定義的 interface
- [ ] 17. 更新 `quickCommand.ts`：使用 `resolveDateRange()` 取代 `parsePeriod()`
- [ ] 18. 更新 `queryEngine.ts`：使用 `resolveDateRange()` 取代 `resolvePeriod()`
- [ ] 19. 更新 `page.tsx` (Home)：3 個 `getXxxEntries()` 提取為共用的 Firestore 查詢工具

## Batch B — 消除重複

### R3: QuickCommand 重構

- [ ] 20. 建立 `src/services/commands/` 目錄與 `Command` interface
- [ ] 21. 建立 `registry.ts`：指令註冊中心，取代 if-else 鏈
- [ ] 22. 拆出 `expense.command.ts` (`/記`)
- [ ] 23. 拆出 `query.command.ts` (`/查`)
- [ ] 24. 拆出 `todo.command.ts` (`/待`)
- [ ] 25. 拆出 `insight.command.ts` (`/洞察`)
- [ ] 26. 拆出 `budget.command.ts` (`/預算`, `/預算 設定`)
- [ ] 27. 拆出 `archive-query.command.ts` (`/問`)
- [ ] 28. 拆出 `files.command.ts` (`/recent_files`)
- [ ] 29. 精簡 `quickCommand.ts`：替換為 registry 入口 (~30 行)
- [ ] 30. 移除 `guessTag()`：統一使用 `ClassificationEngine.match()` fallback

### R4: any 型別清除

- [ ] 31. `message.service.ts`：3 處 `any` → 使用統一 models
- [ ] 32. `insights.ts`：2 處 `any` → 定義 `ExpenseSummary` interface
- [ ] 33. `gemini/parser.ts`：3 處 `err: any` → `unknown` + type guard
- [ ] 34. `gemini/vision.ts`：2 處 `any` → `unknown` + type guard
- [ ] 35. `gemini/client.ts`：1 處 `error: any` → `unknown`
- [ ] 36. `gemini/sessionManager.ts`：1 處 `tools: any[]` → 正確的 SDK 型別
- [ ] 37. `gemini/fileManager.ts`：1 處 `c: any` → Gemini SDK `Corpus` 型別
- [ ] 38. `calendar/client.ts`：3 處 `any` → Google Calendar API 型別
- [ ] 39. `drive/client.ts`：1 處 `media: any` → Drive API 型別
- [ ] 40. `page.tsx` (Home)：3 處 `entry: any` → 使用統一 models
- [ ] 41. `archive/route.ts`：1 處 `entry: any` → `ArchiveEntry`
- [ ] 42. `TagPieChart.tsx`：1 處 `props: any` → 定義 `ActiveShapeProps` interface

## Batch C — 前端重構

### R5: CSS 模組化 & 頁面元件拆解

- [ ] 43. 從 `globals.css` 拆出 `styles/navbar.css`（L128-180）
- [ ] 44. 從 `globals.css` 拆出 `styles/cards.css`（L205-420：glass-card, tag-badge, stat, accounting, archive）
- [ ] 45. 從 `globals.css` 拆出 `styles/modal.css`（L500-683：overlay, card, form, buttons）
- [ ] 46. 從 `globals.css` 拆出 `styles/forms.css`（L443-498：filter-bar, select, input, empty-state）
- [ ] 47. 從 `globals.css` 拆出 `styles/login.css`（L707-818：login page + spinner + animations）
- [ ] 48. 在 `globals.css` 中 `@import` 所有拆出的 CSS 模組
- [ ] 49. 精簡 `globals.css`：僅保留 CSS Variables, Reset, Body, Typography (~120 行)
- [ ] 50. `recurring/page.tsx`：拆出 `RecurringForm` 子元件（Modal 表單部分）
- [ ] 51. `recurring/page.tsx`：拆出 `RecurringCard` 子元件（列表卡片部分）
- [ ] 52. `settings/rules/page.tsx`：拆出 `RuleEditRow` 子元件（inline 編輯行）
- [ ] 53. `accounting/page.tsx`：拆出 filter 邏輯為 custom hook `useAccountingFilters()`
