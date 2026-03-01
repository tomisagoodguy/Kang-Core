## Tasks

- [x] **Task 1**: 安裝 Google Drive SDK
  - `yarn add googleapis`
  - 更新 `package.json`

- [x] **Task 2**: 更新 Schema 支援圖片欄位
  - `AccountingCard` / `ArchiveCard` interface 加入 `imageUrl?: string`

- [x] **Task 3**: 建立 Google Drive 上傳工具
  - 建立 `src/lib/drive/client.ts`
  - 實作 `uploadImageToDrive()` function
  - 使用 Service Account 認證，自動建立子資料夾，設定公開分享

- [x] **Task 4**: 建立 Gemini Vision 分析工具
  - 建立 `src/lib/gemini/vision.ts`
  - 實作 `analyzeImage()` function
  - 使用 `gemini-2.5-flash` multimodal，回傳 `GeminiParseResult`

- [x] **Task 5**: 更新 Webhook 處理圖片訊息
  - 更新 `src/app/api/webhook/line-bot/route.ts`
  - `processEvent` 新增 `image` 類型處理
  - 並行執行 Drive 上傳 + Vision 分析
  - 存 Firestore 含 `imageUrl`
  - `pushMessage` 回覆結果

- [x] **Task 6**: 更新儀表板元件顯示縮圖
  - 更新 `src/components/AccountingCard.tsx`：若有 `imageUrl` 顯示縮圖
  - 更新 `src/components/ArchiveCard.tsx`：若有 `imageUrl` 顯示 cover 縮圖

- [x] **Task 7**: Vercel 環境變數（需手動設定）
  - `GOOGLE_DRIVE_CLIENT_EMAIL` = `kang-core-drive@kang-core.iam.gserviceaccount.com`
  - `GOOGLE_DRIVE_PRIVATE_KEY` = Service Account private key
  - `GOOGLE_DRIVE_FOLDER_ID` = `12xk8zhOUYUYd3bY2s0Z7blK-Pc3txmD0`
