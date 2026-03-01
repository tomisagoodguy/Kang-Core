# Spec: 圖片 → Google Drive 功能

## 1. `src/lib/drive/client.ts`

```typescript
uploadImageToDrive(
  imageBuffer: Buffer,
  filename: string,
  subfolder: "receipts" | "screenshots"
): Promise<string>
```

**行為**：
- 使用 Service Account credentials 初始化 `google.auth.JWT`
- 在 `GOOGLE_DRIVE_FOLDER_ID` 下尋找或建立 subfolder
- 使用 `drive.files.create` 上傳圖片
- 使用 `drive.permissions.create` 設定 `anyone` + `reader` 公開讀取
- 回傳 `https://drive.google.com/uc?export=view&id={fileId}`

---

## 2. `src/lib/gemini/vision.ts`

```typescript
analyzeImage(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png"
): Promise<GeminiParseResult>
```

**行為**：
- 使用 `gemini-2.5-flash` 模型（支援 Vision）
- 傳入 base64 encoded image part
- System Prompt 引導模型判斷：收據 vs. 截圖 vs. 其他
- 從收據提取：`amount`, `tag`, `date`, `description`
- 從截圖提取：`summary`, `keywords`, `title`
- 回傳 `GeminiParseResult`（與文字解析相同格式）

**收據 System Prompt 重點**：
```
If this is a receipt/invoice/bill:
- type = "accounting"
- Extract total amount paid
- Guess tag from merchant type
- Use date on receipt, or today if unclear

If this is a screenshot/article/note:
- type = "archive"
- Summarize the content
- Extract keywords

Respond with JSON only.
```

---

## 3. Webhook 修改

`processEvent` 函式新增 image 分支：

```typescript
if (event.message.type === "image") {
  // 1. 下載圖片（使用 LINE SDK getMessageContent）
  const stream = await client.getMessageContent(event.message.id);
  const imageBuffer = await streamToBuffer(stream);

  // 2. 並行：上傳 Drive + Gemini Vision 分析
  const [driveUrl, parsedData] = await Promise.all([
    uploadImageToDrive(imageBuffer, `${Date.now()}.jpg`, "receipts"),
    analyzeImage(imageBuffer, "image/jpeg"),
  ]);

  // 3. 存 Firestore（含 driveUrl）
  // 4. pushMessage 回覆使用者
}
```

---

## 4. Schema 更新（`src/models/schema.ts`）

`BaseEntrySchema` 新增：
```typescript
imageUrl: z.string().url().optional(),
```

Source enum 新增：
```typescript
"line-image"
```

---

## 5. 儀表板元件更新

**`AccountingCard`**：
- 若 `entry.imageUrl` 存在，在卡片左側顯示 `<img src={entry.imageUrl} width={60} height={60} />` 縮圖

**`ArchiveCard`**：
- 若 `entry.imageUrl` 存在，顯示縮圖（`width: 100%`, `height: 120px`, `object-fit: cover`）

---

## 6. 環境設定指南

使用者需完成：
1. Google Cloud Console → 建立 Service Account
2. 賦予 Service Account Google Drive API 權限
3. 下載 Service Account JSON 金鑰
4. 在 Google Drive 建立 `kang-core` 資料夾，右鍵分享給 Service Account email（編輯者權限）
5. 複製資料夾 ID（URL 裡的最後一段）
6. 在 Vercel 設定 3 個環境變數
