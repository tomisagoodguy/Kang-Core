# Kang-Core

個人 AI 生活助理系統。以 LINE Bot 作為自然語言輸入介面，透過 Gemini AI 解析意圖，整合記帳、知識庫、行事曆、定期支出等功能，搭配 Next.js Web Dashboard 提供視覺化管理。

**核心理念**：用一句話就能記帳、查資料、設提醒——AI 負責學習分類規則，減少重複決策。

---

## 技術堆疊

| 技術 | 版本 | 用途 |
| ------ | ------ | ------ |
| Next.js | 16.1.6 | App Router + API Routes |
| React | 19.2.3 | Dashboard UI |
| TypeScript | 5.x | 嚴格型別 |
| TailwindCSS | 4.x | 樣式（PostCSS 整合） |
| Zustand | 5.0.11 | 狀態管理 |
| Recharts | 3.7.0 | 圖表元件 |
| Firebase Admin/Client SDK | latest | Firestore + Google OAuth |
| Google Gemini | `gemini-2.5-flash` | 意圖解析、OCR、Embedding |
| @line/bot-sdk | 10.6.0 | LINE Webhook |
| Zod | 4.3.6 | API 輸入驗證 |

**部署**：Vercel｜**資料庫**：Cloud Firestore

---

## 快速開始

### 前置需求

- Node.js 20+
- Yarn 1.22+
- Firebase 專案（Firestore + Authentication）
- LINE Messaging API Channel
- Google Gemini API Key
- Google Cloud Project（Calendar / Drive / Sheets OAuth）

### 安裝

```bash
git clone https://github.com/your-username/Kang-Core.git
cd Kang-Core
yarn install
```

### 環境變數

建立 `.env.local` 並填入以下變數：

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_USER_IDS=Uxxx,Uyyy          # 逗號分隔多用戶 LINE ID

# Google Gemini
GEMINI_API_KEY=

# Firebase（後端）
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=             # 注意 \n 換行符需正確轉義

# Google OAuth（Calendar / Drive / Sheets）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Dashboard 多用戶
EMAIL_LINE_MAP=admin@gmail.com:Uxxx,mom@gmail.com:Uyyy
AUTHORIZED_EMAILS=admin@gmail.com,mom@gmail.com

# 系統
CRON_SECRET=

# Firebase Client（前端，7 個變數）
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### 開發

```bash
yarn dev          # 啟動開發伺服器（localhost:3000）
yarn build        # 建置 production bundle
yarn lint         # ESLint 檢查
```

### Firestore 索引

首次部署或新增索引後執行：

```bash
npx tsx scripts/create-firestore-indexes.ts
```

---

## 訊息處理 Pipeline

LINE Bot 接收訊息後依序執行四個階段：

```text
1. Threads 口語化識別   ~即時   偵測 threads.net URL / @帳號追蹤指令
2. 快速指令            ~50ms   /記 /查 /預算 等前綴比對
3. 分類學習引擎        ~300ms  信心度 ≥ 0.7 自動分類（Firestore 學習規則）
4. Gemini 意圖解析     ~2s     AI 判斷 9 種意圖（記帳/查詢/存檔/行事曆等）
   Fallback: 帶 Session 記憶的對話
```

---

## 功能模組

| 模組 | 說明 |
| ------ | ------ |
| **記帳** | 自然語言記帳、分類學習、標籤管理、預算警報 |
| **知識庫** | 存檔任意文字/圖片，支援 RAG 向量語意搜尋 |
| **行事曆** | 新增事件/待辦，自動同步 Google Calendar |
| **定期支出** | 設定每月固定支出，Cron 自動插入 |
| **旅遊模式** | 旅遊期間自動將支出標記為 Travel 標籤 |
| **Threads 追蹤** | 追蹤 Threads 帳號，每日摘要推播 |
| **AI 摘要** | 月度支出分析（1 小時快取） |
| **Dashboard** | Next.js Web 介面，Google OAuth 登入保護 |

---

## Cron Jobs

`vercel.json` 定義 7 個定時任務（括號為台灣時間 UTC+8）：

| 排程 | 台灣時間 | 任務 |
| ------ | --------- | ------ |
| `0 13 * * *` | 21:00 每日 | 消費摘要推播 |
| `0 0 * * *` | 08:00 每日 | 行事曆提醒 |
| `0 1 1 * *` | 09:00 每月1日 | 月報 |
| `5 16 * * *` | 00:05 每日 | 定期支出自動插入 |
| `0 2 * * 0` | 10:00 每週日 | 舊訊息清理 |
| `0 15 28-31 * *` | 23:00 月底 | Google Sheets 匯出 |
| `0 12 * * *` | 20:00 每日 | Threads 摘要 |

每個 Cron 端點需要 `Authorization: Bearer ${CRON_SECRET}` 標頭。

---

## 認證架構

Dashboard 採 Firebase Google OAuth + Session Cookie：

1. 前端 Google 登入 → `POST /api/auth/session`（建立 5 天 httpOnly Cookie）
2. `src/middleware.ts` 保護所有 Dashboard 路徑，Cookie 不存在 → 導向 `/login`
3. API Route 使用 `withAuth` wrapper 自動注入 `userId`
4. 所有 Firestore 查詢**必須**帶 `userId`（資料隔離在 API 層）

---

## 工具腳本

```bash
npx tsx scripts/backfill-embeddings.ts      # 為舊知識庫補建 Embedding
npx tsx scripts/backfill-userId.ts          # 舊資料遷移（一次性）
npx tsx scripts/create-firestore-indexes.ts # 部署 Firestore 複合索引
npx tsx scripts/refresh-google-token.ts     # 更新 Google OAuth Token
npx tsx scripts/setup-rich-menu.ts          # 設定 LINE Rich Menu
```

### Python 爬蟲（Threads Scraper）

```bash
cd services/threads-scraper
uv sync
uv run python main.py
```

---

## 目錄結構

```text
src/
├── app/
│   ├── api/            # API Routes（webhook、cron、各功能 CRUD）
│   ├── accounting/     # 記帳 Dashboard
│   ├── archive/        # 知識庫 Dashboard
│   ├── calendar/       # 行事曆 Dashboard
│   ├── recurring/      # 定期支出 Dashboard
│   ├── threads/        # Threads 追蹤 Dashboard
│   ├── settings/       # 標籤與規則設定
│   └── login/          # Firebase Google 登入
├── components/         # 可複用 React 元件
├── lib/
│   ├── firebase/       # admin.ts / client.ts / auth.ts
│   ├── gemini/         # client、embedding、vision、parser、session
│   └── auth/           # getSessionUserId、withAuth
├── services/           # 業務邏輯核心
├── models/schema.ts    # TypeScript 型別 + Zod Schema（單一事實來源）
└── utils/              # 常數、日期工具、標籤 Emoji
scripts/                # 維護腳本
services/threads-scraper/  # Python Threads 爬蟲
```

---

## License

MIT
