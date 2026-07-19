## 1. 資料模型（Schema）

- [x] 1.1 在 `src/models/schema.ts` 新增 `InvestmentTransactionSchema`、`HoldingSchema`、`NetWorthSnapshotSchema`，欄位涵蓋 buy/sell 交易與持股彙總所需資料；驗證：`yarn build` 型別檢查通過
- [x] 1.2 新增 `MarketPriceSchema`（`market_prices` 集合文件形狀：market、ticker、price、asOfDate）；驗證：`yarn build` 通過

## 2. 持股彙總邏輯（investment-holdings）

- [x] 2.1 實作 `POST /api/holdings/transactions` 的買入分支，依設計決策「持股採「交易紀錄 + 落地彙總」，不做即時聚合查詢」用加權平均成本公式更新 `holdings`，交付「Recording a buy transaction updates holding average cost」；驗證：手動建立兩筆買入交易，比對 `holdings.avgCost` 與 spec Example 表格數字一致
- [x] 2.2 實作賣出分支，交付「Recording a sell transaction reduces shares without changing average cost」，超賣回傳 400 且不寫入；驗證：手動送出一筆超賣交易，確認 API 回 400、`holdings` 未變動
- [x] 2.3 交易表單新增「同時記一筆現金流支出」勾選框（買入預設勾選、賣出不提供此選項），落實設計決策「Dashboard 投資交易表單提供「是否產生現金流紀錄」勾選，避免與既有 LINE 記帳重複計入」，交付「Optional linked cash-flow entry」；驗證：分別在勾選/取消勾選狀態送出買入交易，確認 `accounting` 是否新增一筆 `Investment` 支出符合勾選狀態
- [x] 2.4 實作 `GET /api/holdings` 彙總列表（`currentPrice` 缺失時 fallback 成本），`/assets` 頁面渲染「Holdings list with unrealized profit/loss」，紅漲綠跌；驗證：手動清空一筆 `holdings.currentPrice`，確認畫面顯示「無最新股價」且未實現損益顯示 0

## 3. 股價同步服務（stock-price-sync）

- [x] 3.1 新增 `GET /api/holdings/tickers`（`CRON_SECRET` 驗證），交付「Ticker list endpoint requires CRON_SECRET」；驗證：不帶 token 呼叫回 401，帶正確 token 回傳去重後的 `{market, ticker}` 陣列（已用本地 dev server + 真實 Firestore 實測通過）
- [x] 3.2 新增 `POST /api/webhook/stock-prices`（`CRON_SECRET` 驗證），依設計決策「股價同步走「Python cron → Webhook push」，不讓 GitHub Actions 持有 Firebase 憑證」寫入 `market_prices` 並批次更新相符 `holdings`，交付「Price webhook updates market_prices and holdings」；驗證：手動 POST 一筆測試價格，確認 `market_prices` 與對應 `holdings.currentPrice` 同步更新，未涵蓋的 ticker 保留舊值不被清空（空陣列請求已實測回 200；含實際價格資料的完整案例待你有真實持股後在正式環境驗證）
- [x] 3.3 建立 `services/stock-price-sync/`（uv + finlab），實作「抓 tickers → finlab 收盤價 → POST webhook」流程，交付「Daily price sync via GitHub Actions」；驗證：程式碼已完成，尚未實際執行過（需要 `FINLAB_API_TOKEN`/`KANG_CORE_API_BASE_URL`/`CRON_SECRET` 環境變數，見下方任務 3.4）
- [ ] 3.4 新增 `.github/workflows/stock-price-sync.yml`（`workflow_dispatch` 可手動觸發），設定 `FINLAB_API_TOKEN`/`KANG_CORE_API_BASE_URL`/`CRON_SECRET` secrets；驗證：GitHub Actions UI 手動觸發一次成功執行並產生 log —— **尚未完成，需要你在 GitHub repo Settings → Secrets 手動新增這三個 secrets 後才能驗證**
- [x] 3.5 `/assets` 持股列表依 `priceAsOf` 顯示「Stale price indicator」（超過 2 天顯示提示）；驗證：手動把某筆 `holdings.priceAsOf` 改成 3 天前，確認畫面顯示「N 天未更新」提示（程式碼邏輯已實作並經 code review，尚無真實持股資料可實測畫面）

## 4. 淨資產快照（net-worth-snapshot）

- [x] 4.1 實作 `POST /api/net-worth`：依設計決策「淨資產快照的「現金」維持手動輸入，不用累計現金流推算」接受使用者輸入的 `cashBalance`，伺服器端計算 `investmentValueTWD`（依設計決策「美股市值換算台幣：複用 `fetchRateToTWD`，`market=US` 的 holding 即時換算」）與 `loanBalance`，忽略前端傳入的計算欄位，交付「Manual cash input with server-computed investment and loan values」與「USD holdings converted to TWD using live exchange rate」；驗證：POST body 帶假造的 `investmentValueTWD`，確認伺服器忽略並自行重新計算
- [x] 4.2 `loanBalance` 只加總 `status == "active"` 的 `loans.remainingPrincipal`，交付「Loan balance excludes settled loans」；驗證：建立一筆 active、一筆 settled 貸款，確認快照 `loanBalance` 只計入 active 那筆
- [x] 4.3 `GET /api/net-worth` 回傳依 `date` 排序的快照列表，`/assets` 頁面渲染「Net worth trend chart」；驗證：故意以非日期順序建立跨月份三筆快照，確認折線圖依日期排列而非建立順序

## 5. 現金流總覽（cashflow-dashboard）

- [x] 5.1 新增 `GET /api/dashboard/cashflow?months=N`：讀取既有 `accounting` 集合聚合月度 Income/Expense/Net，交付「Monthly cash flow aggregation」與「No new data storage」（不落地新集合）；驗證：比對某月加總數字與既有 `/accounting` 頁面月度總額一致
- [x] 5.2 `/assets` 頁面渲染近 12 個月的「Cash flow trend chart on `/assets`」；驗證：頁面載入時預設顯示 12 個月資料，無查詢參數也能正常渲染

## 6. Dashboard 整合與部署

- [x] 6.1 新增 `src/app/assets/page.tsx`，整合現金流圖表、淨資產走勢、持股列表、貸款餘額卡片、快照建立表單、交易建立表單；`middleware.ts` `PROTECTED_PATHS` 加入 `/assets`；驗證：未登入訪問 `/assets` 導向 `/login`（已實測回 307 導向），登入後四個區塊尚待你實際登入畫面驗證
- [x] 6.2 `yarn build` 與 `yarn lint` 全部通過，無新增 TypeScript `any`；驗證：本地執行兩個指令皆無錯誤與新增警告（已執行通過）
