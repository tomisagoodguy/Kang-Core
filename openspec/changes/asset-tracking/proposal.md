## Why

目前 Kang-Core 只記錄「單筆收支流水」，看不出資產累積的全貌：不知道每月現金流淨額、不知道目前淨資產多少、不知道手上持有哪些股票/ETF 現在賺賠多少。使用者希望能大略（非即時）掌握「收入/支出/現金流/資產現值/主要投資標的」，作為記帳系統的延伸價值，而不只是流水帳。

## What Changes

- 新增「現金流總覽」：用既有 `accounting` 資料按月聚合 Income/Expense/淨現金流，Dashboard 新增趨勢圖表（不需新資料結構）
- 新增「投資交易紀錄」：新的 `investment_transactions` 集合記錄每筆買/賣（市場、代號、股數、單價、手續費），寫入時同步更新 `holdings` 彙總文件（股數、平均成本），並沿用既有 `Investment` 標籤在 `accounting` 補一筆現金流紀錄（維持既有現金流統計正確）
- 新增「股價同步」：新 Python 服務 `services/stock-price-sync/`，透過 GitHub Actions 排程用 finlab 抓取使用者持股清單的最新收盤價，POST 到新 Webhook 端點 `/api/webhook/stock-prices`（比照現有 `threads-scraper` 的 push 架構，非即時，每日一次）
- 新增「淨資產快照」：新的 `net_worth_snapshots` 集合，使用者手動記錄一次「現金/存款」，系統自動加上「持股現值（依最新收盤價，缺價退回成本）」、減去「貸款餘額（`loans.remainingPrincipal`）」算出淨資產，存成時間序列供 Dashboard 畫走勢圖
- 新增 Dashboard 頁面 `/assets`：現金流圖表、淨資產走勢圖、持股列表（含未實現損益）、貸款卡片彙總、「記錄本月快照」操作

## Non-Goals

（design.md 會建立，Non-Goals 記錄在該處）

## Capabilities

### New Capabilities

- `cashflow-dashboard`: 用既有記帳資料按月聚合收入/支出/淨現金流並視覺化
- `investment-holdings`: 投資交易紀錄與持股彙總（股數、平均成本、未實現損益）
- `stock-price-sync`: 每日透過 finlab 同步持股收盤價的 Python 服務與 Webhook
- `net-worth-snapshot`: 淨資產快照（現金 + 持股現值 − 貸款餘額）與走勢圖

### Modified Capabilities

（無現有 spec 需更動，既有貸款與記帳資料只被讀取，不改變其既有行為契約）

## Impact

- **新增 Firestore 集合**：`investment_transactions`、`holdings`、`market_prices`、`net_worth_snapshots`
- **新增 API Routes**：`/api/holdings`（交易 CRUD + 彙總 GET）、`/api/holdings/tickers`（供 cron 查詢待抓代號清單，`CRON_SECRET` 驗證）、`/api/webhook/stock-prices`（接收股價同步，`CRON_SECRET` 驗證）、`/api/net-worth`（快照 CRUD）、`/api/dashboard/cashflow`（月度聚合 GET）
- **新增 Dashboard 頁面**：`src/app/assets/page.tsx`，`middleware.ts` `PROTECTED_PATHS` 加入 `/assets`
- **新增 Python 服務**：`services/stock-price-sync/`（比照 `services/threads-scraper/` 的 uv + GitHub Actions 架構），新增 `.github/workflows/stock-price-sync.yml`
- **新增環境變數/Secrets**：GitHub Actions 需要 `FINLAB_API_TOKEN`（新增）、`KANG_CORE_API_BASE_URL`（新增，Kang-Core 部署網址）、`CRON_SECRET`（沿用既有）
- **讀取既有資料**：`accounting`（現金流聚合）、`loans.remainingPrincipal`（淨資產扣除負債）
- **資料限制**：finlab 僅涵蓋 TW/US 等其市場範圍內的股票/ETF；非該範圍或未上市標的無法自動同步股價，`holdings` 需允許手動覆蓋現價
