# Tasks: 巨石代碼解耦

- [x] 1. 建立 `src/services` 及基礎服務：`line.service.ts`, `drive.service.ts`, `discord.service.ts`。將底層實作邏輯抽出。
- [x] 2. 建立 `src/services/message.service.ts`，並將原本在 `route.ts` 的 `handleTextMessage`, `handleImageMessage`, `handleFileMessage`, `processEvent` 搬移至這裡。
- [x] 3. 修改 `src/app/api/webhook/line-bot/route.ts`：移除被抽離的邏輯，使用 `MessageService.processEvent`。
- [x] 4. 確保所有 Imports 正確，TypeScript 編譯通過 (`yarn build` 或 `yarn type-check`)。
- [x] 5. 使用 `yarn lint --fix` 和 `yarn format` (如果存在) 對這幾支檔案做品質檢核。
