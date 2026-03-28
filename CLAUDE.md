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
│   │   ├── webhook/            # LINE Bot 接收入口
│   │   ├── cron/               # Vercel Cron Jobs（8 個定時任務）
│   │   ├── accounting/         # 記帳 CRUD
│   │   ├── archive/            # 知識庫 CRUD
│   │   ├── calendar/           # 行事曆與待辦 CRUD
│   │   ├── recurring/          # 定期支出規則 CRUD
│   │   ├── budget/             # 預算 API
│   │   ├── rules/              # 分類規則 CRUD
│   │   ├── tags/               # 自訂標籤
│   │   ├── insights/           # AI 摘要（1 小時快取）
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
│   ├── firebase/               # admin.ts（後端）/ client.ts（前端）
│   ├── gemini/                 # Gemini API 封裝（client、embedding、vision、parser）
│   ├── calendar/               # Google Calendar API
│   ├── drive/                  # Google Drive API
│   └── sheets/                 # Google Sheets API
├── services/                   # 業務邏輯（核心）
│   ├── message.service.ts      # 訊息路由中樞（4 階段 Pipeline）
│   ├── classificationEngine.ts # ML 分類學習引擎
│   ├── quickCommand.ts         # 快速指令（/記 /查 /預算 等）
│   ├── queryEngine.ts          # 自然語言查詢解析
│   ├── archiveQuery.service.ts # RAG 向量搜尋
│   ├── insights.ts             # AI 摘要快取管理
│   └── session.service.ts      # 對話記憶（5 訊息 / 15 分鐘 TTL）
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
npx tsx scripts/backfill-embeddings.ts   # 為舊知識庫項目補建 Embedding
npx tsx scripts/setup-rich-menu.ts       # 設定 LINE Rich Menu
```

### Python 爬蟲（threads-scraper）
```bash
uv sync                                  # 安裝 Python 依賴
uv run python services/threads-scraper/main.py
```

---

## 訊息處理 Pipeline

LINE Bot 接收到訊息後，`message.service.ts` 依序執行：

1. **快速指令**（`quickCommand.ts`）— 匹配 `/記`、`/查`、`/預算` 等前綴，直接回應（~50ms）
2. **分類規則**（`classificationEngine.ts`）— 以學習到的關鍵字規則比對，信心度 ≥ 0.7 自動分類（~300ms）
3. **Gemini 意圖解析**（`lib/gemini/parser.ts`）— AI 判斷 9 種意圖（記帳/查詢/存檔/行事曆等）（~2s）
4. **Fallback**（`lib/gemini/client.ts`）— 帶入 Session 記憶的 Gemini 對話

---

## 分類學習引擎

`classificationEngine.ts` 是核心智慧模組，理解其邏輯才能正確修改：

- **信心度規則**：新規則 0.8 → 每次命中 +0.02 → 使用者手動修正 0.95
- **觸發門檻**：≥ 0.7 自動分類；< 0.7 在設定頁面標示待確認
- **快取**：Firestore `classification_rules` + 5 分鐘記憶體快取
- **禁止**：勿直接寫死分類關鍵字，應透過此引擎讓系統自主學習

---

## Firestore 集合

| 集合 | 主要欄位 |
|------|---------|
| `accounting` | date, amount, tag, subTag, description, source |
| `archive` | title, content, embedding[], keywords, imageUrl |
| `calendar` | startTime, title, type(event/todo), completed, syncedToGCal |
| `recurring_expenses` | frequency, dayOfMonth, amount, tag, enabled |
| `budgets` | monthYear, limit, notifiedAt80/100 |
| `classification_rules` | keyword, tag, confidence, hitCount, source |
| `custom_tags` | parentTag, subtags[] |
| `sessions` | userId, messages[], TTL: 15 分鐘 |
| `insights` | monthYear, insight, TTL: 1 小時 |
| `processed_messages` | messageId, TTL: 7 天（去重用）|

---

## Cron Jobs

`vercel.json` 定義 8 個定時任務（UTC 時間，台灣 = UTC+8）：

| Cron | 台灣時間 | 用途 |
|------|---------|------|
| `0 13 * * *` | 21:00 | 每日消費摘要 |
| `0 0 * * *` | 08:00 | 行事曆提醒 |
| `0 1 1 * *` | 09:00 每月1日 | 月報 |
| `5 16 * * *` | 00:05 | 定期支出自動插入 |
| `0 2 * * 0` | 10:00 週日 | 舊訊息清理 |
| `30 14 * * *` | 22:30 | 日記提示 |
| `0 15 28-31 * *` | 23:00 月底 | Google Sheets 匯出 |
| `0 12 * * *` | 20:00 | Threads 摘要 |

每個 Cron 端點需要 `Authorization: Bearer ${CRON_SECRET}` 標頭驗證。

---

## 環境變數（必要）

```
# LINE
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET

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

# 系統
CRON_SECRET               # Cron Job 驗證金鑰
NEXT_PUBLIC_FIREBASE_*    # 前端 Firebase 設定（7 個變數）
```

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
