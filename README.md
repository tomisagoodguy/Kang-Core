# 🧠 Kang-Core — 個人 AI 生活助理

> 一個整合 LINE Bot × Gemini AI × Firebase × Google Drive 的個人全方位生活管理系統。  
> 部署於 Vercel，純 TypeScript + Next.js App Router。

---

## ✨ 功能總覽

### 💬 訊息處理（智能路由）

所有 LINE 訊息進入後，系統依照以下優先順序路由：

```
用戶訊息
├── 1. 快速指令（/help、/記、/查 等）→ 直接處理，不走 AI
├── 2. 分類規則引擎（已學習的關鍵字）→ 直接處理，不走 AI
├── 3. Gemini AI 解析（識別意圖）
│   ├── accounting → 記帳
│   ├── archive    → 知識收藏
│   ├── calendar   → 行事曆/待辦
│   ├── recurring  → 定期支出設定
│   ├── query      → 資料查詢
│   └── clear_memory → 清除對話記憶
└── 4. Fallback → Gemini Chat（有上下文記憶）
```

---

## 📋 功能詳解

### 💰 記帳系統

| 觸發方式 | 說明 |
|---|---|
| 直接輸入文字 | `「吃飯花了 150」` → Gemini 解析金額、標籤、日期 |
| 快速指令 | `/記 150 午餐` |
| 傳圖片/收據截圖 | Gemini Vision 自動辨識金額與分類 |
| 規則引擎自動匹配 | 常去的店家第二次輸入直接免 AI 解析 |

**支援標籤**：`Food` / `Transport` / `Entertainment` / `Utilities` / `Shopping` / `Health` / `Education` / `Income` / `Other`

**入帳（收入）識別**：輸入「收到薪水 50000」等也能正確分類為 Income。

---

### 🔄 定期支出

- 說「每月 10 號付家裡伙食費 7000」→ Gemini 解析並建立定期規則
- 支援頻率：`daily` / `weekly` / `monthly` / `yearly`
- **Cron 自動入帳**：每日 00:05（台灣）自動執行，符合日期的定期支出自動寫入記帳

---

### 📦 知識庫（Archive）

- 貼任何文字、連結、截圖 → Gemini 自動摘要 + 提取關鍵字，存入 Firestore
- 圖片類型由 **Gemini Vision** 分析後存檔
- 每筆 Archive 資料自動生成 **向量 Embedding**（Gemini Text Embedding），支援語意搜尋
- 檔案（PDF、DOCX 等）同步上傳至 **Gemini File Search Store**（Corpus），可直接詢問文件內容

---

### 🗓️ 行事曆 & 待辦

- 說「明天下午三點開會討論預算」→ 自動寫入 Firestore + **同步 Google Calendar**
- 說「/待 繳電費」→ 建立無日期待辦，同步 Google Calendar
- 說「/完成 電費」→ 模糊匹配標記完成

---

### 🔍 查詢功能

**快速指令**

| 指令 | 功能 |
|---|---|
| `/查 本月` | 本月消費統計（含標籤分類） |
| `/查 上月` / `/查 本週` / `/查 上週` / `/查 今天` | 各時段查詢 |
| `/洞察` | AI 分析近期消費習慣，給出建議 |
| `/問 {問題}` | RAG 知識庫語意搜尋（詢問已收藏的資料） |
| `/預算` | 查看本月預算使用狀況 |
| `/預算 設定 5000` | 設定月總預算 |
| `/recent_files` | 列出 Google Drive 最近上傳的 5 個檔案 |
| `/help` | 查看所有快速指令 |

**自然語言查詢**（透過 Gemini 解析）

- 「幫我查這週交通費」→ 自動識別為查詢意圖，返回統計

---

### 📎 檔案 & 媒體管理（Google Drive）

- **圖片**：收到後上傳 Drive + Gemini Vision 分析（記帳或歸檔）
- **影片/音訊/文件**：上傳至 Drive 保存
- **儲存路徑**：`{根資料夾}/archive/{YYYY-MM}/{檔名}`，自動按月分類
- 所有上傳的 Drive 檔案設為公開可讀取（產生可分享的連結）

---

### 🤖 AI 引擎

| 模組 | 說明 |
|---|---|
| **Gemini Pro（解析）** | 解析所有用戶輸入的意圖與結構化資料 |
| **Gemini Vision** | 圖片內容分析（收據、截圖、筆記） |
| **Gemini Chat Session** | 具備上下文記憶的對話（保留最近 3 輪，15 分鐘 TTL） |
| **Gemini Text Embedding** | 為 Archive 資料生成向量，支援語意搜尋 |
| **Gemini File Search (Corpus)** | 上傳文件供後續自然語言問答 |

---

### 🧠 分類學習引擎（ClassificationEngine）

- 每次記帳成功後，系統**學習**該商家/描述 → 標籤的對應關係
- 下次輸入相同關鍵字時，**繞過 Gemini** 直接套用規則（節省 API 配額）
- 規則存於 Firestore `classification_rules` 集合，含 5 分鐘記憶體快取
- 輸入清理：過濾特殊字元防止注入

---

### 💡 預算警報

- 月消費超過預算 **80%** → 發送警報（每月只提醒一次）
- 月消費超過預算 **100%** → 再次提醒
- 警報紀錄防重複推播

---

### ⚙️ Cron 自動排程（Vercel Cron Jobs）

| 排程 | 功能 | 台灣時間 |
|---|---|---|
| `0 0 * * *` | 🗓 今日行程提醒（有行程才推送） | 每天 08:00 |
| `0 13 * * *` | 📊 每日消費摘要推播 | 每天 21:00 |
| `30 14 * * *` | 🌙 每日日記提示 | 每天 22:30 |
| `5 16 * * *` | 🔄 定期支出自動入帳 | 每天 00:05 |
| `0 15 28-31 * *` | 📊 月底帳目匯出 Google Sheets | 當月最後一天 23:00 |
| `0 1 1 * *` | 📈 每月月報＋AI 洞察推播 | 每月 1 日 09:00 |
| `0 0 * * *` | 🧹 已處理訊息清理（防重複 TTL） | 每天 08:00 |

---

### 📊 Google Sheets 匯出

- 每月底自動將當月所有帳目匯出至 Google Sheets
- 含：日期、金額、標籤、子標籤、描述、來源
- 匯出後透過 LINE 推送試算表連結

---

### 🎨 Web Dashboard（Next.js）

- `/` — 帳目一覽（含搜尋、篩選、分頁）
- `/archive` — 知識庫管理
- `/accounting` — 詳細記帳記錄
- `/recurring` — 定期支出管理
- 支援深色/淺色主題切換

---

### 🔒 安全性

- LINE Webhook 簽名驗證（防偽造請求）
- Cron 端點 Bearer Token 驗證
- Middleware Cookie 驗證（保護 Dashboard 路由）
- ClassificationEngine 輸入清理（XSS / 注入防護）
- 防重複處理鎖（Firestore `processed_messages`，防 LINE 重傳）

---

## 🗺️ Firebase 資料結構

| Collection | 說明 |
|---|---|
| `accounting` | 記帳記錄 |
| `archive` | 知識庫收藏（含 embedding） |
| `calendar` | 行事曆 & 待辦事項 |
| `recurring_expenses` | 定期支出規則 |
| `budgets` | 預算設定 |
| `budget_alerts` | 預算警報推播紀錄（防重複） |
| `classification_rules` | AI 學習的分類規則 |
| `processed_messages` | 已處理訊息 ID（防重複） |

---

## 🧪 技術堆疊

| 類別 | 技術 |
|---|---|
| 框架 | Next.js 15 (App Router) |
| 語言 | TypeScript |
| AI | Google Gemini (Pro / Vision / Embedding / Chat / Files API) |
| 資料庫 | Firebase Firestore |
| 儲存 | Google Drive API |
| 試算表 | Google Sheets API |
| 行事曆 | Google Calendar API |
| Bot | LINE Messaging API (`@line/bot-sdk`) |
| 部署 | Vercel（含 Cron Jobs） |
| 套件管理 | yarn |

---

## 🔮 未來計畫（TODO）

### 高優先

- [ ] **Rich Menu 完整設定** — 目前 `richMenu.service.ts` 已有基礎，需補完選單圖片與 action mapping
- [ ] **影片/音訊訊息處理** — 目前收到後靜默略過，可加入上傳 Drive + 轉錄
- [ ] **Archive 語意搜尋 UI** — Dashboard 目前只有關鍵字搜尋，可加入向量語意搜尋介面

### 中優先

- [ ] **Discord 通知細化** — 目前 `discordService` 固定推全部通知，可加入類型篩選
- [ ] **Gemini File Search 查詢整合** — `FileManager` 已能上傳 Corpus，還需補完 `/問` 的 Corpus 查詢路徑
- [ ] **Google Sheets 雙向同步** — 目前只匯出，可做 Sheets → Firestore 回寫
- [ ] **定期支出 CRUD** — 目前只能新增（透過對話），缺少停用/刪除指令

### 低優先

- [ ] **多用戶支援** — 目前硬編 `LINE_USER_ID`，所有 Cron 推播只推給一人
- [ ] **Telegram Bot 並行** — 架構已模組化，可加第二個 Bot 接口
- [ ] **圖表視覺化** — Dashboard 目前無消費趨勢圖表
- [ ] **收據 OCR 精度提升** — 可改用 Document AI 取代純 Gemini Vision

---

## 🚀 環境變數

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_USER_ID=                   # 個人 LINE User ID（Cron 推播用）

# Google / Gemini
GEMINI_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=         # Drive 根資料夾 ID
GOOGLE_SHEETS_ID=               # 匯出用試算表 ID
GOOGLE_CALENDAR_ID=             # 行事曆 ID

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Discord（選填）
DISCORD_WEBHOOK_URL=

# Vercel Cron
CRON_SECRET=                    # Cron 端點保護密鑰
```
