# 圖片 → Google Drive 設計文件

## 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| Drive 認證 | Service Account | 不需使用者 OAuth，伺服器端操作 |
| Drive SDK | `googleapis` npm | 官方套件，支援完整 Drive API v3 |
| 圖片分析 | Gemini Vision | 已整合 `@google/generative-ai`，multimodal 支援 |
| 圖片格式 | JPEG/PNG | LINE 圖片下載格式 |

## 環境變數（新增）

| 變數名 | 說明 |
|---|---|
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` | Service Account 的 email |
| `GOOGLE_DRIVE_PRIVATE_KEY` | Service Account private key（需 `\n` 轉換） |
| `GOOGLE_DRIVE_FOLDER_ID` | kang-core 主資料夾的 Drive Folder ID |

## 元件設計

### `src/lib/drive/client.ts`
- `uploadImageToDrive(imageBuffer: Buffer, filename: string, subfolder: "receipts" | "screenshots"): Promise<string>`
  - 使用 `googleapis` 上傳檔案
  - 回傳可公開讀取的 Google Drive URL

### `src/lib/gemini/vision.ts`
- `analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<GeminiParseResult>`
  - 使用 `gemini-2.5-flash` 分析圖片（multimodal）
  - 回傳與 `parseUserInput()` 相同格式的 `GeminiParseResult`
  - 新增 `imageUrl` 寫入邏輯

### Webhook 修改（`src/app/api/webhook/line-bot/route.ts`）
- 擴充 `processEvent` 以處理 `event.message.type === "image"`
- 流程：下載圖片 → 上傳 Drive → Gemini Vision 分析 → 存 Firestore → 回覆

## Drive 連結格式

上傳後取得 file ID，Public URL 格式：
```
https://drive.google.com/uc?export=view&id={FILE_ID}
```

設定分享權限：`Anyone with the link can view`（使用 Drive API 設定 permission）

## 儀表板卡片更新

- `AccountingCard` 新增：若有 `imageUrl`，顯示縮圖（`<img>` 帶 `width=80`）
- `ArchiveCard` 新增：若有 `imageUrl`，顯示縮圖

## 圖片類型對應

| 圖片內容（Gemini 判斷） | 儲存位置 | Firestore Collection |
|---|---|---|
| 收據、發票、帳單 | `kang-core/receipts/` | `accounting` |
| 截圖、文章、筆記 | `kang-core/screenshots/` | `archive` |
| 無法辨識 | `kang-core/screenshots/` | 回覆「無法辨識」 |
