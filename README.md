# 🧠 Kang-Core — 個人 AI 生活助理

> 整合 LINE Bot × Gemini AI × Firebase × Google Drive 的個人全方位生活管理系統。
> 部署於 Vercel，純 TypeScript + Next.js App Router。

---

## ✨ 功能總覽

### 💬 訊息處理（智能路由）

所有 LINE 訊息進入後，系統依照以下優先順序路由：

```
用戶訊息
├── 1. 快速指令 (/help、/記、/查 等) → 直接處理，不走 AI
├── 2. 分類規則引擎（已學習的關鍵字）→ 直接處理，不走 AI
├── 3. Gemini AI 解析（識別意圖）
│   ├── accounting  → 記帳
│   ├── archive     → 知識收藏
│   ├── calendar    → 行事曆 / 待辦
│   ├── recurring   → 定期支出設定
│   ├── query       → 資料查詢
│   └── clear_memory → 清除對話記憶
└── 4. Fallback → Gemini Chat（有上下文記憶）
```

---

## 📋 功能詳解

### 💰 記帳系統

| 觸發方式          | 說明                                                     |
| ----------------- | -------------------------------------------------------- |
| 直接輸入文字      | `「吃飯花了 150」` → Gemini 解析金額、標籤、日期      |
| 快速指令          | `/記 150 午餐`                                         |
| 傳圖片 / 收據截圖 | Gemini Vision 自動辨識金額與分類                         |
| 規則引擎自動匹配  | 常去的店家第二次輸入直接免 AI 解析（附 🏷 自動分類標註） |

**支援標籤**：`Food` / `Transport` / `Entertainment` / `Utilities` / `Shopping` / `Health` / `Education` / `Income` / `Other`

**入帳（收入）識別**：輸入「收到薪水 50000」等也能正確分類為 Income。

---

### 🧠 分類學習引擎（ClassificationEngine）

- 每次記帳成功後，系統**學習**商家/描述 → 標籤的對應關係
- 下次輸入相同關鍵字時，**繞過 Gemini** 直接套用規則（節省 API 配額，延遲從 ~2s 降至 ~300ms）
- **信心指數（Confidence）機制**：
  - 新規則預設 `0.8`
  - 每次命中自動微增 `+0.02`
  - 使用者從 Dashboard **手動修改 tag → confidence 提升至 0.95**（最高品質訓練訊號）
  - 只有 `confidence ≥ 0.7` 的規則才會被自動套用
- 規則存於 Firestore `classification_rules`，含 5 分鐘記憶體快取
- 輸入清理：過濾特殊字元防注入

---

### 🔄 定期支出

- 說「每月 10 號付家裡伙食費 7000」→ Gemini 解析並建立定期規則
- 支援頻率：`daily` / `weekly` / `monthly` / `yearly`
- **Cron 自動入帳**：每日 00:05（台灣）自動執行，符合日期的定期支出自動寫入記帳
- Web Dashboard `/recurring` 頁面：列表 + 新增/編輯 Modal + 啟停 Toggle

---

### 📦 知識庫（Archive）

- 貼任何文字、連結、截圖 → Gemini 自動摘要 + 提取關鍵字，存入 Firestore
- 圖片類型由 **Gemini Vision** 分析後存檔，原圖備份至 Google Drive
- 每筆 Archive 資料自動生成 **向量 Embedding**（Gemini `text-embedding-004`），支援語意 RAG 搜尋
- 檔案（PDF、DOCX 等）同步上傳至 **Gemini File Search Store（Corpus）**，可直接詢問文件內容

---

### 🧩 Context Memory（對話記憶）

- **Session 管理**：每位用戶的對話歷史保存在 Firestore `sessions` 集合
- TTL：最近 **5 條訊息** 或 **15 分鐘內**
- Gemini 解析時自動帶入對話歷史，讓 AI 理解上下文（如「那它多少錢？」可正確承接前文）
- 輸入 `/clear` 或 `清除記憶` → 立即清空 Session

---

### 🔍 RAG 語意搜尋（Retrieval-Augmented Generation）

- `/問 {問題}` — 對知識庫進行**語意向量搜尋**（cosine similarity），找出最相關的 Archive 存檔後，交由 Gemini 合成答案
- 自動識別「幫我找跟 XX 有關的收藏」等查詢意圖，路由至 RAG pipeline
- 向量由 `text-embedding-004` 產生，儲存於每筆 archive 文件

---

### 🗓️ 行事曆 & 待辦

- 說「明天下午三點開會討論預算」→ 自動寫入 Firestore + **同步 Google Calendar**
- `/待 繳電費` → 建立無日期待辦，同步 Google Calendar
- `/完成 電費` → 模糊匹配標記完成

---

### 🔍 查詢功能

**快速指令**

| 指令                                                      | 功能                                   |
| --------------------------------------------------------- | -------------------------------------- |
| `/查 本月`                                              | 本月消費統計（含標籤分類）             |
| `/查 上月` / `/查 本週` / `/查 上週` / `/查 今天` | 各時段查詢                             |
| `/洞察`                                                 | AI 分析近期消費習慣，給出建議          |
| `/問 {問題}`                                            | RAG 知識庫語意搜尋（詢問已收藏的資料） |
| `/預算`                                                 | 查看本月預算使用狀況                   |
| `/預算 設定 5000`                                       | 設定月總預算                           |
| `/待 {事項}`                                            | 快速建立待辦                           |
| `/完成 {關鍵字}`                                        | 標記待辦完成                           |
| `/記 {金額} {說明}`                                     | 快速記帳（不走 AI）                    |
| `/recent_files`                                         | 列出 Google Drive 最近上傳的 5 個檔案  |
| `/help`                                                 | 查看所有快速指令                       |

**自然語言查詢**（透過 Gemini 解析）

- 「幫我查這週交通費」→ 自動識別為查詢意圖，返回統計

---

### 💡 預算警報

- 月消費超過預算 **80%** → 發送警報（每月只提醒一次）
- 月消費超過預算 **100%** → 再次提醒
- 警報紀錄防重複推播

---

### 📎 檔案 & 媒體管理（Google Drive）

- **圖片**：收到後上傳 Drive + Gemini Vision 分析（記帳或歸檔）
- **影片 / 音訊 / 文件**：上傳至 Drive 保存
- **儲存路徑**：`{根資料夾}/archive/{YYYY-MM}/{檔名}`，自動按月分類
- 所有上傳的 Drive 檔案設為公開可讀取（產生可分享連結）

---

### ⚙️ Cron 自動排程（Vercel Cron Jobs）

| 排程（UTC）        | 功能                            | 台灣時間           |
| ------------------ | ------------------------------- | ------------------ |
| `0 0 * * *`      | 🗓 今日行程提醒（有行程才推送） | 每天 08:00         |
| `0 13 * * *`     | 📊 每日消費摘要推播             | 每天 21:00         |
| `30 14 * * *`    | 🌙 每日日記提示                 | 每天 22:30         |
| `5 16 * * *`     | 🔄 定期支出自動入帳             | 每天 00:05         |
| `0 15 28-31 * *` | 📊 月底帳目匯出 Google Sheets   | 當月最後幾天 23:00 |
| `0 1 1 * *`      | 📈 每月月報 + AI 洞察推播       | 每月 1 日 09:00    |
| `0 2 * * 0`      | 🧹 已處理訊息清理（防重複 TTL） | 每週日 10:00       |

---

### 📊 Google Sheets 匯出

- 每月底自動將當月所有帳目匯出至 Google Sheets
- 含：日期、金額、標籤、子標籤、描述、來源
- 匯出後透過 LINE 推送試算表連結

---

### 🎨 Web Dashboard（Next.js）

| 路由                | 功能                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `/`               | 帳目一覽（含搜尋、篩選、分頁）                                    |
| `/accounting`     | 詳細記帳記錄 + 月趨勢圖 +**互動式圓餅圖（點擊展開子標籤）** |
| `/archive`        | 知識庫管理                                                        |
| `/recurring`      | 定期支出管理（CRUD + 啟停）                                       |
| `/settings/tags`  | 自訂子標籤管理（主分類 → 子分類兩層）                            |
| `/settings/rules` | 分類規則管理（含 Confidence 指標、低信心規則高亮警示）            |

- 支援**深色 / 淺色**主題切換（`localStorage` 記憶偏好）
- 圓餅圖支援 **Drill-Down**：點擊父標籤展開子標籤分佈，含返回總覽按鈕

---

### 🔒 安全性

- LINE Webhook 簽名驗證（HMAC-SHA256，防偽造請求）
- Cron 端點 Bearer Token 驗證（`CRON_SECRET`）
- Middleware Cookie 驗證（保護 Dashboard 路由）
- ClassificationEngine 輸入清理（XSS / 注入防護）
- 防重複處理鎖（Firestore `processed_messages`，防 LINE 重傳）
- userId 嚴格隔離（洞察、快速指令均綁定個人 userId）

---

## 🗺️ Firebase 資料結構

| Collection               | 說明                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| `accounting`           | 記帳記錄（含 `subTag` 可選欄位）                               |
| `archive`              | 知識庫收藏（含 `embedding` 向量陣列）                          |
| `calendar`             | 行事曆 & 待辦事項                                                |
| `recurring_expenses`   | 定期支出規則                                                     |
| `budgets`              | 預算設定                                                         |
| `budget_alerts`        | 預算警報推播紀錄（防重複）                                       |
| `classification_rules` | AI 學習的分類規則（含 `confidence`、`hitCount`、`source`） |
| `custom_tags`          | 使用者自訂子標籤                                                 |
| `sessions`             | 對話 Session 記憶（TTL 15 分鐘）                                 |
| `insights`             | AI 洞察快取（1 小時 TTL，避免重複呼叫）                          |
| `processed_messages`   | 已處理訊息 ID（防重複，7 天 TTL）                                |

---

## 🧪 技術堆疊

| 類別     | 技術                                                        |
| -------- | ----------------------------------------------------------- |
| 框架     | Next.js 16 (App Router)                                     |
| 語言     | TypeScript                                                  |
| AI       | Google Gemini (Pro / Vision / Embedding / Chat / Files API) |
| 資料庫   | Firebase Firestore                                          |
| 儲存     | Google Drive API                                            |
| 試算表   | Google Sheets API                                           |
| 行事曆   | Google Calendar API                                         |
| Bot      | LINE Messaging API (`@line/bot-sdk`)                      |
| 圖表     | Recharts                                                    |
| 部署     | Vercel（含 Cron Jobs）                                      |
| 套件管理 | yarn                                                        |

---

## 🔮 未來計畫（Roadmap）

### 高優先

- [ ] **Rich Menu 完整設定** — `richMenu.service.ts` 已有骨架，需補完選單圖片與 action mapping，提升操作體驗
- [ ] **Archive 語意搜尋 UI** — Dashboard 目前只有關鍵字搜尋，加入向量語意搜尋介面（輸入問題 → 列出最相關收藏）
- [ ] **影片 / 音訊轉錄** — 目前收到後靜默略過，接入 Whisper / Gemini Audio 進行語音轉文字後歸檔

### 中優先

- [ ] **分類規則低 Confidence 自動降權** — 使用者刪除或修正某規則時，自動降低同類 keyword 的 confidence，避免錯誤規則持續生效
- [ ] **Gemini File Search 查詢整合** — `FileManager` 已能上傳 Corpus，補完 `/問` 的 Corpus 查詢路徑，讓 AI 可回答文件內容
- [ ] **圓餅圖子標籤歷史篩選** — 依「月份 + 子標籤」組合進行 Drill-Down，目前只支援當月
- [ ] **Google Sheets 雙向同步** — 目前只匯出，可做 Sheets → Firestore 回寫（從試算表更正帳目）
- [ ] **對話記憶跨 Session 搜尋** — 目前 Session 只保留 15 分鐘，可改為永久歷史並對話摘要歸檔至 Archive

### 低優先

- [ ] **多用戶支援** — 目前硬編 `LINE_USER_ID`，全系統僅服務一人；重構為 userId 多租戶架構
- [ ] **Telegram Bot 並行** — 架構已模組化，可接第二個 Bot 入口，共享同一組 Firestore 資料
- [ ] **收據 OCR 精度提升** — 可改用 Google Document AI 取代純 Gemini Vision，提高金額辨識準確率
- [ ] **PWA Service Worker** — `manifest.json` 已完成，補完 `sw.js` 離線快取策略，讓 Dashboard 可作為手機 App 安裝
- [ ] **LINE 群組支援** — 目前只處理 1-on-1 訊息，群組記帳 / 分帳場景
- [ ] **匯率換算** — 出國消費時自動換算外幣，歸一到台幣後記帳

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

# Firebase Auth（Dashboard 登入）
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```


🛡️ Kang-Core 資安審計報告 (Vibe Coding 階段)
項目基本資訊
項目名稱： Kang-Core
目標使用者： 個人（助理用途）
技術棧： Next.js 16 (App Router), Firebase (Auth/Firestore), LINE Messaging API, Google Gemini API, Google Calendar/Drive API.
部署環境： Vercel
🚨 第一部分：資安風險評估

1. 高風險 - 敏感環境變數缺少負載保護與驗證
風險等級： 高
威脅描述： 專案大量依賴 process.env，但在開發初期，開發者常會忘記在 Vercel 生產環境之外進行嚴格驗證。如果 .env.local 意外洩露，或者更糟的是，某些金鑰在 Webpack 打包時被錯誤地暴露到了前端，攻擊者將獲得完整的控制權。
受影響元件： .env.local,

src/lib/firebase/auth.ts
 (前端使用的環境變數)
CAUTION

駭客攻擊劇本 (Hacker's Playbook) 「我是一個觀察者。我發現你的網站使用了 Firebase。我打開 F12 開發者工具，在 Source 標籤頁搜尋 AIza。 bingo！我找到了你的 NEXT_PUBLIC_FIREBASE_API_KEY。雖然這是公開的，但我接著找有沒有其他的。我發現你用 Fetch 呼叫了 /api/auth/session。如果你的 API 沒有嚴格檢查 CORS 或來源，我可以偽造一個 idToken 傳給你的後端。如果你的白名單設定不當，我甚至能建立一個合法的 Session 進入你的儀表板。」

修復建議：
確保只有以 NEXT_PUBLIC_ 開頭的變數才會被推送到前端。
使用 zod 在應用啟動時驗證所有必備的環境變數。
2. 高風險 - LINE Webhook 簽章驗證弱點
風險等級： 中 (已實作基礎驗證但可優化)
威脅描述： 雖然你在

src/app/api/webhook/line-bot/route.ts
 實作了 validateSignature，但如果 LINE_CHANNEL_SECRET 沒設好，驗證會直接失效。此外，對於大型事件流，缺少對重放攻擊 (Replay Attack) 的深度防護。
受影響元件：

src/app/api/webhook/line-bot/route.ts
TIP

修復原理 (Principle of the Fix) LINE 的簽章就像是一封信上的「火漆印」。如果印章壞了（Secret 沒設定），誰都可以假裝自己是 LINE 傳訊息給你。後端應該像嚴格的守門員，只要印章有一點點不對，就直接把信丟掉。

修復建議：
typescript
// 修正後：嚴格檢查 Secret 是否存在
if (!channelSecret) {
    throw new Error("LINE_CHANNEL_SECRET is missing!");
}
3. 高風險 - Middleware 權限繞過風險
風險等級： 高
威脅描述： 你的 middleware.ts 使用了 PUBLIC_PATHS 白名單。如果攻擊者發現某個 API 路徑（例如 /api/threads/config）雖然不在 PROTECTED_PATHS 中，但卻處理敏感行為，就能繞過驗證。
受影響元件：

src/middleware.ts
IMPORTANT

駭客攻擊劇本 (Hacker's Playbook) 「我在看你的 middleware.ts。我發現 /api/threads/config 這個路徑。我嘗試直接訪問它，果然不需要 Session Cookie。雖然你裡面有檢查 CRON_SECRET，但如果我能透過某種方式（例如日誌洩漏）拿到這個 Secret，我就能拿到你所有追蹤的 Threads 帳號清單。」

修復建議：
採用「預設拒絕 (Default Deny)」策略，所有 /api 下的路徑除了明確標註為 PUBLIC 的之外，都必須經過驗證。
對於 Cron Job API，除了 Secret 驗證，應限制僅允許 Vercel 的 IP 區段存取。
🚨 第二部分：針對大型項目的特別策略
我發現專案中存在多個 API Route 使用了相同的 CRON_SECRET 驗證模式（例如：/api/cron/*系列與 /api/admin/* 系列）。

IMPORTANT

自動化掃描請求 我發現了一個潛在的風險模式：多處 API 依賴單一環境變數進行身份驗證。為了確保找出所有類似問題，您是否同意我為您生成一個 Python 腳本，使用正則表達式來快速掃描整個 src/app/api 下的所有路由，確認其驗證機制是否一致且無遺漏？這個腳本只會進行讀取和搜尋，不會修改任何文件。

🚨 第三部分：OWASP Top 10 快速盤查結果
編號 項目 狀態 風險描述 / 建議
A01 權限控制失效 ⚠️ 中 middleware.ts 的白名單過於寬鬆，建議改為黑名單排除法或更嚴格的路由保護。
A03 注入式攻擊 ✅ 安全 使用 Firestore SDK，天然防禦 SQL 注入。但注意 Firebase Rules 的設定。
A05 安全設定錯誤 ⚠️ 高 vercel.json 中的 Cron API 是公開的，僅靠 Header 驗證。建議加上來源 IP 限制。
A06 過時元件 ⚠️ 低 next 版本為 16.1.6 (實驗性)，需注意其安全性公告。
A10 SSRF ✅ 安全 目前未發現用戶可控的 URL 請求導向。
🛡️ 總結建議
Firebase Security Rules：請務必檢查你的 Firebase Firestore Rules，確保不是 allow read, write: if true;。這是一切防禦的基礎。
強制 HTTPS：Vercel 預設開啟。
Session 安全：在 api/auth/session 中，secure: process.env.NODE_ENV === "production" 是正確的做法，請保持。
