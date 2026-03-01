# 圖片 → Google Drive + Gemini Vision 解析 Proposal

## 問題陳述

目前 LINE Bot 只能處理文字訊息，圖片會被直接忽略。  
使用者無法透過傳收據照片、截圖來記帳或存檔，大幅限制了日常使用的便利性。

## 目標

讓使用者可以直接在 LINE 傳送圖片，系統自動：
1. 將圖片上傳到使用者的 **Google Drive**（`kang-core/` 資料夾）
2. 用 **Gemini Vision** 分析圖片內容
3. 判斷是「收據（記帳）」或「截圖/資料（存檔）」
4. 將解析結果（含 Drive 圖片連結）存入 **Firestore**
5. 回覆使用者結果

## 非目標

- 不實作使用者手動選擇 Drive 資料夾
- 不實作圖片編輯或裁切功能
- 不實作 Google OAuth 登入（使用 Service Account 代為上傳）

## 方案

### 整體流程

```
LINE 傳圖片
    ↓
Webhook 收到 image 類型訊息
    ↓
① 用 LINE SDK 下載圖片 binary
    ↓
② 上傳到 Google Drive（Service Account）
   → 存放路徑：kang-core/receipts/ 或 kang-core/screenshots/
   → 取得公開分享連結
    ↓
③ 將圖片 binary 給 Gemini Vision 分析
   → 判斷：收據？截圖？其他？
   → 提取：金額、店家、日期、摘要、關鍵字
    ↓
④ 存入 Firestore（文字 + Drive URL）
    ↓
⑤ 用 pushMessage 回覆使用者結果
```

### Google Drive 整合方式

使用 **Google Service Account**（而非 OAuth）：
- 建立一個 Service Account，授予 Drive 寫入權限
- 將 Service Account JSON 憑證設為 Vercel 環境變數
- 用 `googleapis` npm 套件操作 Drive API

Drive 資料夾結構：
```
kang-core/           ← 主資料夾（手動建立並分享給 Service Account）
├── receipts/        ← 收據照片
└── screenshots/     ← 其他截圖/圖片
```

### Gemini Vision 分析

使用 `gemini-2.5-flash` 的 multimodal 功能（支援 image input）：
- 傳入圖片 binary（base64）
- Prompt：判斷是收據還是截圖，提取相關資訊
- 輸出格式與現有 `GeminiParseResult` 相同，新增 `imageUrl` 欄位

### Firestore 文件結構更新

`accounting` document 新增欄位：
```json
{
  "imageUrl": "https://drive.google.com/uc?id=XXXXX",
  "source": "line-image"
}
```

`archive` document 新增欄位：
```json
{
  "imageUrl": "https://drive.google.com/uc?id=XXXXX",
  "source": "line-image"
}
```

## 成功指標

- 使用者傳收據照片 → 自動記帳，圖片存 Drive
- 使用者傳截圖 → 自動存檔，圖片存 Drive
- Firebase 只增加一字串欄位，不儲存圖片本體
- 儀表板卡片可顯示 Drive 縮圖
