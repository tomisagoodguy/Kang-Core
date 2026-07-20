# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 專案本質

Kang-Core 是一個**個人 AI 生活助理系統**，以 LINE Bot 作為自然語言輸入介面，透過 Gemini AI 解析意圖，並整合記帳、知識庫、行事曆、定期支出等功能，搭配 Next.js Web Dashboard 提供視覺化管理。

核心設計理念：**減少使用者操作摩擦**——用一句話就能記帳、查資料、設提醒，AI 負責學習分類規則，減少重複決策。部署於 Vercel，Firestore 作為主要資料庫，Google 生態系（Calendar、Drive、Sheets）作為延伸整合。

---

## 技術堆疊

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.6 | App Router + API Routes，唯一後端入口 |
| **React** | 19.2.3 | Dashboard UI |
| **TypeScript** | 5.x | 嚴格型別，`@/*` 路徑別名對應 `./src/*` |
| **TailwindCSS** | 4.x | 樣式，使用 PostCSS 整合（**非 3.x 語法**）|
| **Zustand** | 5.0.11 | 輕量狀態管理 |
| **Recharts** | 3.7.0 | 圖表元件 |
| **Firebase Admin SDK** | latest | 後端 Firestore 讀寫、Auth 驗證 |
| **Firebase Client SDK** | latest | 前端登入（Google OAuth） |
| **Google Gemini** | `gemini-2.5-flash` | 意圖解析、OCR、Embedding、對話記憶 |
| **@line/bot-sdk** | 10.6.0 | LINE Webhook 接收與訊息發送 |
| **Zod** | 4.3.6 | API 輸入驗證 |
| **Yarn** | 1.22+ | **唯一套件管理工具（禁用 npm install）** |

---

## 目錄結構

```
src/
├── app/
│   ├── api/                    # 所有 API Routes
│   │   ├── webhook/line-bot/   # LINE Bot 接收入口（實際路徑含子目錄）
│   │   ├── cron/               # Vercel Cron Jobs（11 個定時任務）
│   │   ├── accounting/         # 記帳 CRUD
│   │   ├── archive/            # 知識庫 CRUD
│   │   ├── calendar/           # 行事曆與待辦 CRUD
│   │   ├── recurring/          # 定期支出規則 CRUD
│   │   ├── budget/             # 預算 API
│   │   ├── rules/              # 分類規則 CRUD
│   │   ├── tags/               # 自訂標籤
│   │   └── threads/            # Threads 追蹤
│   ├── accounting/             # Dashboard：記帳頁面
│   ├── archive/                # Dashboard：知識庫頁面
│   ├── calendar/               # Dashboard：行事曆頁面
│   ├── recurring/              # Dashboard：定期支出頁面
│   ├── threads/                # Dashboard：Threads 追蹤頁面
│   ├── settings/               # Dashboard：設定（標籤、規則）
│   └── login/                  # Firebase Google 登入頁
├── components/                 # 可複用 React 元件
│   └── charts/                 # Recharts 圖表元件
├── lib/
│   ├── firebase/               # admin.ts（後端）/ client.ts（前端）/ auth.ts
│   ├── gemini/                 # client.ts、embedding.ts、vision.ts、parser.ts、sessionManager.ts、fileManager.ts
│   ├── auth/                   # getSessionUserId.ts（Session Cookie → LINE userId）、withAuth.ts（API Route wrapper）
│   ├── userRegistry.ts         # getAllLineUserIds()（Cron 迭代）、getLineUserIdFromEmail()（Dashboard）
│   ├── calendar/               # Google Calendar API
│   ├── drive/                  # Google Drive API
│   └── sheets/                 # Google Sheets API
├── services/                   # 業務邏輯（核心）
│   ├── message.service.ts      # 訊息路由中樞（4 階段 Pipeline）
│   ├── classificationEngine.ts # ML 分類學習引擎（per-userId 隔離）
│   ├── quickCommand.ts         # 快速指令（/記 /查 /預算 等）
│   ├── queryEngine.ts          # 自然語言查詢解析
│   ├── archiveQuery.service.ts # RAG 向量搜尋
│   ├── archiveTagEngine.ts     # 知識庫標籤自動推斷
│   ├── rag.service.ts          # Embedding 相似度搜尋
│   ├── insights.ts             # AI 摘要快取管理
│   ├── budget.service.ts       # 預算超支警報
│   ├── session.service.ts      # 對話記憶（5 訊息 / 15 分鐘 TTL）
│   ├── line.service.ts         # LINE API 封裝（reply/push）
│   ├── drive.service.ts        # Google Drive 上傳封裝
│   ├── discord.service.ts      # Discord 通知
│   └── travelMode.service.ts   # 旅遊模式狀態管理（user_settings 集合）
├── models/
│   └── schema.ts               # TypeScript 型別 + Zod Schema（**單一事實來源**）
└── utils/
    ├── constants.ts            # 全域常數
    ├── dateRange.ts            # 日期工具
    └── tagEmoji.ts             # 標籤 ↔ Emoji 對應
scripts/                        # 維護用腳本（tsx 執行）
services/threads-scraper/       # Python Reddit 爬蟲（GitHub Actions 觸發）
vercel.json                     # Cron Job 排程定義
```

---

## 常用指令

### 開發
```bash
yarn dev          # 啟動開發伺服器（localhost:3000）
yarn build        # 建置 production bundle
yarn start        # 執行 production 伺服器（需先 build）
yarn lint         # ESLint 檢查 src/**/*.ts[x]
```

### 工具腳本
```bash
# 執行維護腳本（使用 tsx，非 ts-node）
npx tsx scripts/backfill-embeddings.ts      # 為舊知識庫項目補建 Embedding
npx tsx scripts/backfill-userId.ts          # 舊資料遷移：補填 userId 欄位（一次性）
npx tsx scripts/create-firestore-indexes.ts # 部署 Firestore 複合索引
npx tsx scripts/refresh-google-token.ts     # 更新 Google OAuth Refresh Token
npx tsx scripts/setup-rich-menu.ts          # 設定 LINE Rich Menu
```

### Python 爬蟲（threads-scraper）
```bash
uv sync                                  # 安裝 Python 依賴
uv run python services/threads-scraper/main.py
```

---

## 訊息處理 Pipeline

LINE Bot 接收到訊息後，`message.service.ts` 依序執行：

1. **Threads 口語化識別**（`detectThreadsIntent()`）— 偵測 `threads.net/@xxx` URL 或 `@帳號` + 追蹤關鍵字，直接處理 Threads 追蹤管理（最優先）
2. **快速指令**（`quickCommand.ts`）— 匹配 `/記`、`/查`、`/預算` 等前綴，直接回應（~50ms）
3. **分類規則**（`classificationEngine.ts`）— 以學習到的關鍵字規則比對，信心度 ≥ 0.7 自動分類（~300ms）；若訊息含多個數字則跳過此階段讓 Gemini 精確解析
4. **Gemini 意圖解析**（`lib/gemini/parser.ts`）— AI 判斷 9 種意圖（記帳/查詢/存檔/行事曆等）（~2s）
5. **Fallback**（`lib/gemini/sessionManager.ts`）— 帶入 Session 記憶的 Gemini 對話

---

## 分類學習引擎

`classificationEngine.ts` 是核心智慧模組，理解其邏輯才能正確修改：

- **信心度規則**：新規則 0.8 → 每次命中 +0.02 → 使用者手動修正 0.95
- **觸發門檻**：≥ 0.7 自動分類；< 0.7 在設定頁面標示待確認
- **快取**：Firestore `classification_rules` + 5 分鐘記憶體快取（per-userId Map，不同用戶互不干擾）
- **API 簽名**：`ClassificationEngine.match(text, userId)` / `ClassificationEngine.learn(text, tag, userId, subTag?, isManual?)`，兩個方法都**必須傳入 userId**，規則完全按用戶隔離
- **禁止**：勿直接寫死分類關鍵字，應透過此引擎讓系統自主學習

---

## Firestore 集合

| 集合 | 主要欄位 |
|------|---------|
| `accounting` | date, amount（原幣）, currency, exchangeRate, amountTWD, paymentMethod, settlement, tag, subTag, description, source |
| `archive` | title, content, embedding[], keywords, imageUrl |
| `calendar` | startTime, title, type(event/todo), completed, syncedToGCal |
| `recurring_expenses` | frequency, dayOfMonth, amount, tag, enabled |
| `budgets` | monthYear, monthlyLimit, tag, notifiedAt80/100 |
| `threads_users` | userId, username, platform, trackingEnabled |
| `classification_rules` | userId, keyword, tag, confidence, hitCount, source |
| `custom_tags` | parentTag, subtags[] |
| `sessions` | userId, messages[], TTL: 15 分鐘 |
| `insights` | monthYear, insight, TTL: 1 小時 |
| `processed_messages` | messageId, TTL: 7 天（去重用）|
| `processed_invoices` | 電子發票三層去重鎖：`msg_{messageId}` / `att_{sha256}` / `inv_{發票號碼}_{日期}`（永久保留，防彙整信重寄重複入帳） |
| `einvoice_records` | 家庭電子發票（與個人 accounting 分離）：invoiceNumber, date, merchantName, amount, tag, member(me/dad/mom/null), memberSource, matchedAccountingEntryId |
| `einvoice_member_rules` | 商家 → 成員歸屬規則：userId, merchantKey（`normalizeMerchant()` 正規化）, member |
| `user_settings` | userId, travelMode.{active, destination, startedAt, currency, exchangeRate}（旅遊模式狀態＋當地幣別與啟動時匯率）, annualTravelBudget（年度旅遊預算，台幣） |
| `trips` | userId, destination, startDate, endDate, days, totalTWD（期間 Travel 支出加總，關閉旅遊模式時凍結）, currency |
| `net_worth_snapshots` | userId, date, cashBalance, investmentValueTWD, loanBalance, netWorth（月初 cron 自動落地或 Dashboard 手動建立） |
| `investment_transactions` | userId, market(TW/US), ticker, side(buy/sell), shares, pricePerShare, fee, date（XIRR 計算的現金流來源） |
| `credit_cards` | userId, name, billingDay（出帳日）, dueDay（繳款日）, isActive |
| `credit_card_bills` | userId, creditCardId, periodStart, periodEnd, dueDate, totalAmount, paidAmount, status(unpaid/partial/paid) |

### 資產總覽與投資績效（/assets）

- **淨值計算單一事實來源**：`src/services/netWorth.service.ts`（`NetWorthService`）＝現金 + 持股市值（美股即時匯率換算）− 貸款餘額。`/api/net-worth`（手動快照）與 `/api/cron/net-worth-snapshot`（月初自動快照）都走這裡，勿另寫計算邏輯。
- **XIRR 年化報酬**：`GET /api/holdings/performance` 以 `investment_transactions` 買賣現金流 + 今日市值求解（二分法）。美股歷史交易以**目前**匯率換算（近似值）；交易未滿 30 天不提供（年化會爆炸）。
- **儲蓄率與 FIRE**：`/assets` 前端由 `/api/dashboard/cashflow` 近 12 月資料計算儲蓄率（只計有資料的月份），`FireCalculator`（`src/components/FireCalculator.tsx`）自動帶入平均月支出／月儲蓄／目前淨值，純前端試算不落地。
- **CAGR 複利試算**：`GET /api/market/cagr`（需登入）查詢 Yahoo Finance chart API 算歷史年化報酬率，**務必用 `indicators.adjclose`，不能用 `indicators.quote[0].close`**——close 未還原減資/分割（例：0050 2025 年拆分），算出來的 CAGR 會嚴重失真。`CagrCalculator.tsx` 顯示於 `/assets` 頁，查詢結果自動帶入下方複利試算的年化報酬率輸入框。
- **三情境 FIRE**：`FireCalculator.tsx` 以「中性情境年化報酬率 ± 情境增減幅」算出悲觀/中性/樂觀三種預估達成時間，純前端試算。
- **TWR + 風險指標**：`GET /api/holdings/performance` 除了 XIRR，也用 `net_worth_snapshots` 的月度 `investmentValueTWD` 序列（搭配 `investment_transactions` 現金流做 Modified-Dietz-lite 校正）算 `riskMetrics`：年化 TWR、年化波動度、Sharpe（用固定粗估無風險利率 1.5%，非即時抓取）、最大回撤。**至少需要 3 期報酬率（4 個月快照）才提供**，快照不足回傳 `null`，`/assets` 頁對應區塊會整塊不顯示。未實作 Sortino Ratio（northstar 原始功能列表之一），如需要要另外處理下檔波動的分母計算。

### PWA 離線支援

- **Service Worker**：`public/sw.js`，`ServiceWorkerRegister.tsx`（`layout.tsx` 全站掛載）負責註冊。頁面走 network-first（保資料新鮮，離線退回快取殼或 `public/offline.html`）；`/_next/static/` 與圖片走 cache-first（檔名帶 hash 可長期快取）；**`/api/` 一律不攔截**，避免快取到過期或跨用戶資料。
- **範圍是「離線瀏覽已訪問過的頁面外觀」，不是離線記帳/離線寫入**：本專案是 Firestore 伺服器權威架構（分類學習、預算警報、多用戶隔離都在後端），沒有做 IndexedDB 本地寫入佇列 + 之後同步的離線優先架構（那是 WebApp-KanJi 的做法，屬於完全不同的純前端 IndexedDB 架構，不適合直接搬過來）。離線時記帳/查詢等需要連線的操作仍會失敗。
- **改快取邏輯務必更新 `sw.js` 內的 `CACHE_VERSION`**：檔案內容改變才會讓瀏覽器偵測到新 SW 版本並觸發 `activate` 清掉舊快取；新版本預設不會自動 `skipWaiting`，而是等使用者在畫面右下角「有新版本可用」提示按下「立即更新」才透過 `SKIP_WAITING` 訊息啟用，避免正在使用中的分頁被無預警換版本。

### 多幣別 / 代墊 / 付款方式（記帳延伸欄位）

- **金額三概念**：`amount` 永遠存**原幣**（當地實際付的數字）；`amountTWD` = `amount × exchangeRate`（整筆換算台幣）；統計支出一律透過 `myExpenseTWD()`（`src/utils/currency.ts`）取得「我的那一份換算台幣」。**禁止直接 `reduce` 加總 `amount`**——跨幣別相加無意義，所有統計／圖表/預算/月報都要用 `myExpenseTWD()`。
- **幣別來源**：明確文字（「20鎂」「5歐」）> 旅遊模式幣別 > TWD。旅遊模式**啟動時抓一次匯率**（`lib/exchangeRate.ts`，免金鑰 open.er-api.com，失敗退回靜態表）存進 `travelMode.exchangeRate`，整趟沿用；非當地幣別的零星外幣記帳才即時抓。
- **代墊／借貸**：`settlement.{paidBy, counterparty, myShare, settled}`。`paidBy="me"` → 對方欠我 `amount-myShare`；`paidBy="other"` → 我欠對方 `myShare`。統計只計 `myShare`。LINE 查詢用 `/欠款`、結清用 `/結清 {對方}`。
- **旅程與年度旅遊預算**：關閉旅遊模式時 `TravelModeService.deactivate()` 自動落地一筆 `trips`（凍結該趟 Travel 支出總額）；年度預算存 `user_settings.annualTravelBudget`。LINE 用 `/旅遊` 看年度總覽、`/旅遊預算 {金額}` 設定；開啟/關閉旅遊模式的回覆會帶年度已花與剩餘預算（衝動控制設計）。Dashboard 對應 `/assets` 頁「年度旅遊」區塊與 `GET/PUT /api/trips`。年度支出以「全年 `tag=Travel` 記帳」計算（含旅程外的機票、簽證），不是只加總 trips。
- **付款方式**：`paymentMethod` = `cash|credit_card|e_payment`，由 Gemini 或 `detectPaymentMethod()` 關鍵字判定，純分類用途。
- **編輯陷阱**：Dashboard 改 `amount` 時，`PUT /api/accounting/[id]` 會用原 `exchangeRate` 重算 `amountTWD`，勿讓兩者失同步。

### 信用卡帳單週期 + FIFO 自動沖銷（/credit-cards）

- **記帳綁卡**：`paymentMethod="credit_card"` 的記帳可選填 `creditCardId`（`AddEntryModal.tsx`）。若使用者只有一張啟用中的卡，未指定 `creditCardId` 的舊資料/新記帳也會自動歸屬該卡（`singleCardId` fallback）；多卡使用者未指定卡別的消費不會被任何一期帳單彙整，需手動編輯歸屬。
- **出帳**：`cron/credit-card-billing`（每日 00:10 台灣時間）比對每張卡的 `billingDay`，命中時彙整上次出帳日隔天～今天的刷卡消費（`myExpenseTWD()` 加總），寫入 `credit_card_bills`（`status="unpaid"`）。`dueDate` 規則：若 `dueDay > billingDay` 落在同月，否則落在次月。以 `periodEnd` 唯一性做冪等，同日重跑不會產生重複帳單。
- **FIFO 沖銷**：`POST /api/credit-cards/[id]/pay` 依 `periodEnd` 由舊到新依序沖銷 `unpaid`/`partial` 帳單，繳款金額不足以繳清當期時該期記為 `partial`，超額繳款不建立負數帳單（回傳 `unallocatedAmount`）。
- **勿與 `paymentMethod` 混淆**：`paymentMethod="credit_card"` 只是分類標記；只有同時填了 `creditCardId`（或符合單卡 fallback）的記帳才會被算進帳單週期彙整。

### 帳單到期提醒 / 異常消費提醒（主動推播，不同於被動門檻警報）

- **帳單到期提醒**：`cron/bill-due-reminder`（每日 09:00 台灣時間）提前 3 天（`REMINDER_DAYS_BEFORE`）推播信用卡未繳帳單與 monthly/yearly 定期支出即將自動入帳的提醒。daily/weekly/weekday/holiday 頻率的定期支出太頻繁，不做提前提醒。冪等：信用卡帳單用 `reminderSent` 欄位、定期支出用 `lastReminderTriggerDate`（記錄已提醒過的下次觸發日）避免重複推播。
- **異常消費提醒**：`src/services/anomaly.service.ts`（`checkAnomalyAlert`）在 `message.service.ts` LINE 記帳成功後逐筆判斷，IQR 方法（Q3 + 1.5×IQR，樣本需 ≥ 8 筆）偵測本筆是否遠高於近 180 天日常水準，命中就主動 push LINE。判斷邏輯與 Dashboard `accounting/page.tsx` 的「異常大額支出」視覺化警示一致（同樣排除 `source==="system"` 與房租/家裡分攤等固定必要開銷關鍵字），差別是這裡會主動推播而非只在 Dashboard 顯示。**只掛在 LINE 記帳路徑**，Dashboard 手動新增記帳（`/api/accounting` POST）不會觸發 LINE 推播（Dashboard 本身已有視覺化警示，不需要重複通知）。
- **勿與 `budget.service.ts` 混淆**：`checkBudgetAlert` 是「本月累積支出 vs 預算門檻」的被動警報（80%/100%）；`checkAnomalyAlert` 是「單筆金額 vs 近期消費分布」的即時異常偵測，兩者觸發條件與用途都不同，可能同時觸發。

---

## Cron Jobs

`vercel.json` 定義下列定時任務（UTC 時間，台灣 = UTC+8）：

| Cron | 台灣時間 | 用途 |
|------|---------|------|
| `0 13 * * *` | 21:00 | 每日消費摘要 |
| `0 0 * * *` | 08:00 | 行事曆提醒 |
| `0 1 1 * *` | 09:00 每月1日 | 月報 |
| `5 16 * * *` | 00:05 | 定期支出自動插入 |
| `0 2 * * 0` | 10:00 週日 | 舊訊息清理 |
| `0 15 28-31 * *` | 23:00 月底 | Google Sheets 匯出 |
| `0 12 * * *` | 20:00 | Threads 摘要 |
| `0 0 * * 1` | 08:00 週一 | 週報 Email（上週一～日收支明細） |
| `30 1 1 * *` | 09:30 每月1日 | 淨值快照自動落地（該月已有快照則跳過） |
| `30 12 * * *` | 20:30 | 電子發票自動記帳（趕在 21:00 每日摘要前入帳） |
| `10 1 1 * *` | 09:10 每月1日 | 爸媽消費月報（einvoice_records，member ≠ me 視為爸媽） |
| `10 16 * * *` | 00:10 | 信用卡帳單自動產生（依各卡 billingDay 判斷，緊接在定期支出 cron 之後） |
| `0 1 * * *` | 09:00 | 帳單到期提醒（信用卡未繳帳單 + 定期支出 monthly/yearly，提前 3 天） |

每個 Cron 端點需要 `Authorization: Bearer ${CRON_SECRET}` 標頭驗證。

### 週報 Email

`/api/cron/weekly-email-report` 以 Gmail API（`src/lib/gmail/client.ts`）從授權帳號寄出 HTML 週報，收件者由 `EMAIL_LINE_MAP` 反查（`getEmailFromLineUserId()`，無對應 email 的用戶跳過）。**前提**：`GOOGLE_OAUTH_REFRESH_TOKEN` 必須含 `gmail.send` scope——若寄信回 403/insufficient scopes，重跑 `npx tsx scripts/refresh-google-token.ts` 重新授權並更新 Vercel 環境變數。

### 電子發票自動匯入（家庭帳，與個人帳分離）

`/api/cron/invoice-sync` 從授權 Gmail 讀取財政部「消費發票彙整通知」附件（CSV/TXT/ZIP，`src/lib/einvoice/parser.ts` 解析，支援民國曆與 Big5）。**全家共用同一載具**，發票**不進個人 `accounting`**，落地獨立的 `einvoice_records` 集合——個人統計（儲蓄率／預算／月報）不受家人消費污染。核心邏輯在 `src/services/invoiceImport.service.ts`。

- **成員歸屬（我/爸/媽）三層判定**：①同日同額對到手動記帳 → `member="me"` 並連結該筆（`auto-match`）②`einvoice_member_rules` 商家規則（`rule`）③未歸屬 → Dashboard `/einvoice` 頁手動指定（`manual`），指定時預設寫回規則，同商家（`normalizeMerchant()` 正規化後）之後自動歸屬
- **三層去重**（`processed_invoices` 集合，`doc.create()` 搶鎖）：信件層 `msg_{messageId}` / 附件層 `att_{sha256}` / 發票層 `inv_{發票號碼}_{日期}`——同張發票出現在多封彙整信也不會重複入帳
- **分類鏈**：`ClassificationEngine.match()` → `guessTag()`（quickCommand 匯出的靜態關鍵字兜底）→ `Other`；Dashboard 修正分類會回饋 `ClassificationEngine.learn()`
- **帳本 userId**：Gmail 授權帳號 email 經 `EMAIL_LINE_MAP` 反查，查不到 fallback `LINE_USER_IDS` 第一位
- **API**：`GET /api/einvoice?month=YYYY-MM`（列表）、`PUT /api/einvoice/[id]`（改 member/tag，member 附 `learnRule`）
- **前提 1**：`GOOGLE_OAUTH_REFRESH_TOKEN` 必須含 `gmail.readonly` scope（同上，重跑 refresh-google-token.ts）
- **前提 2**：使用者需在財政部電子發票整合服務平台啟用「寄送消費資訊」到該 Gmail
- 選配環境變數 `GMAIL_INVOICE_QUERY` 可覆寫 Gmail 搜尋條件（預設抓 60 天內含附件的彙整通知）
- 歷史遷移：`scripts/migrate-einvoice-to-family.ts`（一次性，已於 2026-07 執行）

---

## 環境變數（必要）

```
# LINE
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET
LINE_USER_IDS             # 逗號分隔多用戶 LINE ID，例如 "Uxxx,Uyyy"（Cron Jobs 迭代用）
                          # 單用戶舊版 fallback：LINE_USER_ID

# Google Gemini
GEMINI_API_KEY

# Firebase
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY      # 注意換行符 \n 需正確轉義

# Google OAuth（Calendar / Drive / Sheets）
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN

# 多用戶 Dashboard
EMAIL_LINE_MAP            # Google Email → LINE ID 映射，例如 "admin@gmail.com:Uxxx,mom@gmail.com:Uyyy"
AUTHORIZED_EMAILS         # 允許登入 Dashboard 的 Google Email 白名單

# 系統
CRON_SECRET               # Cron Job 驗證金鑰
GMAIL_INVOICE_QUERY       # 選配：覆寫電子發票 Gmail 搜尋條件（預設抓 60 天內彙整通知）
NEXT_PUBLIC_FIREBASE_*    # 前端 Firebase 設定（7 個變數）
```

---

## 認證架構（Multi-User）

Dashboard 採 Firebase Google OAuth + Session Cookie 機制：

1. 前端登入 → `POST /api/auth/session`（建立 5 天 httpOnly Cookie `firebase-session`）
2. `src/proxy.ts`（Next.js 16 的 proxy 檔案慣例，即原 middleware）保護所有 Dashboard 路徑（`PROTECTED_PATHS`：`/`, `/accounting`, `/archive`, `/calendar`, `/recurring`, `/loans`, `/assets`, `/threads`, `/settings`, `/einvoice`），Cookie 不存在 → 導向 `/login`
3. API Route 中呼叫 `getSessionUserId()`（`src/lib/auth/getSessionUserId.ts`）驗證 Cookie 並透過 `EMAIL_LINE_MAP` 取得 LINE userId；或使用 `withAuth` wrapper（`src/lib/auth/withAuth.ts`）自動注入 userId：`export const GET = withAuth(async (req, userId) => { ... })`
4. 所有 Firestore 查詢**必須**帶 `userId`，資料隔離在 API 層而非 Proxy 層

公開路徑（不驗證）：`/login`, `/api/webhook`, `/api/auth`

---

## Firestore 索引

所有複合索引定義於 `firestore.indexes.json`，首欄位均為 `userId`。初次部署或新增索引後須執行：

```bash
npx tsx scripts/create-firestore-indexes.ts
```

---

## 標籤系統

### 現有標籤（單一事實來源：`src/models/schema.ts` + `src/utils/constants.ts`）

| Tag | Emoji | 說明 |
|-----|-------|------|
| `Food` | 🍽 | 餐飲 |
| `Transport` | 🚗 | 交通 |
| `Entertainment` | 🎬 | 娛樂 |
| `Utilities` | 💡 | 水電瓦斯、房租、家裡伙食費分攤 |
| `Shopping` | 🛒 | 購物 |
| `Health` | 🏥 | 醫療保健 |
| `Education` | 📚 | 學費、才藝課、線上學習 |
| `Insurance` | 🛡️ | 各類保險費 |
| `Subscription` | 🔖 | 訂閱服務（YouTube、ChatGPT、Claude 等月費/年費）|
| `Investment` | 📈 | 股票、定期定額、ETF、基金、存股 |
| `Travel` | ✈️ | 旅遊期間支出（旅遊模式自動標記，不受 `NON_TRAVEL_TAGS` 影響的支出會被覆蓋為此標籤）|
| `Income` | — | 收入（統計時**不計入支出**）|
| `Other` | 📦 | 未分類 |

### 新增標籤時必須同步的 9 個檔案

1. `src/models/schema.ts` — `TagEnum` Zod enum
2. `src/utils/constants.ts` — `ALL_TAGS` 陣列
3. `src/utils/tagEmoji.ts` — `TAG_EMOJI_MAP`（emoji）
4. `src/components/AccountingRow.tsx` — `TAG_COLOR_MAP`（列表顏色）
5. `src/components/charts/TagPieChart.tsx` — `TAG_COLORS`（圖表顏色）
6. `src/services/quickCommand.ts` — `guessTag()` 關鍵字規則
7. `src/lib/gemini/parser.ts` — Gemini prompt 中的 tag 清單與說明
8. `src/app/api/cron/monthly-report/route.ts` — 月報本地 emoji map（未使用 `tagEmoji.ts`）
9. `src/services/travelMode.service.ts` — `NON_TRAVEL_TAGS`（若新標籤屬固定支出、不應被旅遊模式覆蓋，須加入此 Set）

### 分類三層架構

```
快速指令關鍵字 (guessTag)        → ~50ms，離線比對
  ↓ 未命中
ClassificationEngine.match()    → ~300ms，Firestore 學習規則（信心度 ≥ 0.7）
  ↓ 未命中
Gemini parser.ts                 → ~2s，AI 解析（消耗 API quota）
```

`guessTag()` 在 `src/services/quickCommand.ts` 是**靜態關鍵字表**，與 `ClassificationEngine` 的動態學習規則分開——前者是硬編碼兜底，後者是用戶行為學習。

### Income 與支出的統計邏輯

- 統計「支出」時必須 `filter(e => e.tag !== "Income")`
- 「最高支出」、「平均支出」等指標同樣需排除 Income
- `queryEngine.ts` 的 `buildSummaryReply()` 是計算統計的核心函式

---

## 常見陷阱

| ❌ 錯誤 | ✅ 正確 |
|--------|--------|
| 在元件中直接呼叫 Firebase Admin SDK | Admin SDK 只能用於 API Routes（`src/app/api/`）|
| 用 `npm install` 安裝套件 | 一律用 `yarn add` |
| 用 TailwindCSS 3.x 的 `@apply` 語法 | 此專案用 TailwindCSS 4，直接用 utility class |
| 修改 `schema.ts` 只改型別 | Zod Schema 與 TypeScript 型別必須同步更新 |
| 新增 Firestore 查詢未加 `userId` 過濾 | **所有查詢必須加 userId 隔離**，否則資料洩漏 |
| 直接呼叫 Gemini 產生摘要 | 先檢查 `insights` 集合快取（1 小時 TTL）|
| 忽略訊息去重機制 | 所有 Webhook 處理前須檢查 `processed_messages` |
| 新增標籤只改 `schema.ts` | 必須同步更新上方列出的 8 個檔案 |
| `monthly-report/route.ts` 用 `getTagEmoji()` | 該檔案有本地 hardcode emoji map，需手動同步 |
| 修改 `next.config.ts` 安全標頭遺漏 Firebase 網域 | CSP 必須放行：`script-src` → `https://apis.google.com`（gapi，缺它 `signInWithPopup` 直接拋 `auth/internal-error`）；`connect-src`/`frame-src` → `*.firebaseapp.com`、`accounts.google.com`、`*.googleapis.com`；`style-src` → `https://fonts.googleapis.com`、`font-src` → `https://fonts.gstatic.com`（Google Fonts） |
