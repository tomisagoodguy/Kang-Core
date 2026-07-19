## Context

Kang-Core 目前只有「單筆收支流水」（`accounting` 集合）與「定期支出/貸款」（`recurring_expenses`、`loans`）。沒有任何「存量」概念：不知道銀行有多少現金、持有幾股股票、股票現在市值多少。既有 `Investment` 標籤的記帳（透過 LINE 快速指令或 Gemini 解析「買股票」文字）只記金額，不記股數，無法算出目前持股與未實現損益。

相關既有基礎：
- `src/lib/exchangeRate.ts` 的 `fetchRateToTWD(currency)`：免金鑰即時匯率，旅遊模式已在用，這次美股市值換算台幣可直接複用
- `loans.remainingPrincipal`（本次「信貸追蹤」功能新增）：已經是即時維護的負債餘額，可直接讀取用於淨資產計算
- `services/threads-scraper/` + `.github/workflows/threads-scraper.yml`：Python + uv + GitHub Actions 排程，抓完資料後 **POST 到 Kang-Core 的 webhook 端點**（`KANG_CORE_WEBHOOK_URL` + `CRON_SECRET` 驗證），而非直接持有 Firebase Admin 憑證寫 Firestore — 這是本次 `stock-price-sync` 要複用的既有架構模式
- 使用者全域 CLAUDE.md 規定：台股相關資料一律透過 `finlab` skill，執行環境 `uv run --with "finlab>=1.5.9" python <script>`，Token 存於 `FINLAB_API_TOKEN`

## Goals / Non-Goals

**Goals:**
- 現金流：用既有 `accounting` 資料按月聚合，不新增資料結構
- 淨資產走勢：現金（手動）+ 持股現值（自動，缺價退回成本）− 貸款餘額（自動，讀 `loans`），存成時間序列
- 持股彙總：記錄每筆買賣（股數、單價），自動維護目前股數與平均成本
- 股價同步：每日一次（非即時）用 finlab 抓 TW/US 持股清單的最新收盤價

**Non-Goals:**
- 不做即時股價（WebSocket/輪詢），finlab 資料本身就是日終資料
- 不計算「已實現損益」（賣出時的資本利得），本版只算「未實現損益」（目前市值 − 目前持股成本）；已實現損益列為 Open Question，留給未來擴充
- 不支援 LINE 自然語言建立投資交易或淨資產快照（比照貸款功能的決策：欄位多、精確度要求高，只做 Dashboard 表單）
- 不做完整複式記帳（不追蹤銀行帳戶明細、不做每筆現金移轉勾稽），淨資產快照的「現金」就是使用者自己估的一個數字
- 不修改既有 LINE/Gemini 的 `Investment` 標籤記帳流程 — 兩者並存，見下方 Decision 4

## Decisions

### 1. 持股採「交易紀錄 + 落地彙總」，不做即時聚合查詢

**選擇**：新增 `investment_transactions`（原始交易）與 `holdings`（彙總，doc id 為 `${userId}_${market}_${ticker}`）兩個集合。寫入交易時同步用 Firestore transaction 更新對應 `holdings` 文件的股數與平均成本。

**理由**：每用戶交易筆數不多（遠小於複合索引門檻），比照本次「貸款」與既有 `recurring_expenses` 的作法（小集合不建複合索引、能算就即時算）；但「持股列表」是 Dashboard 首頁常駐區塊，每次都重新掃全部交易再加總不必要，落地一份彙總文件讀取更直接。

**替代方案**：只存交易紀錄，讀取時即時聚合（比照 scrivener-flow `stock-manager-pnl` 的做法）。缺點：本專案交易頻率遠低於股價數據分析場景，落地彙總的一致性風險（忘記同步更新）可控，換取讀取效能與程式碼簡單。

平均成本計算（買入）：`newAvgCost = (oldShares × oldAvgCost + txShares × pricePerShare + fee) / (oldShares + txShares)`。賣出只減少股數，不變動 `avgCost`（因為不計已實現損益，見 Non-Goals）。賣出股數不可大於目前持股，超賣回傳 400。

### 2. 股價同步走「Python cron → Webhook push」，不讓 GitHub Actions 持有 Firebase 憑證

**選擇**：新增 `services/stock-price-sync/`（uv + finlab），流程：`GET /api/holdings/tickers`（`CRON_SECRET` 驗證，回傳全站去重後的 `{market, ticker}[]`）→ finlab 抓收盤價 → `POST /api/webhook/stock-prices`（`CRON_SECRET` 驗證，body 為價格陣列）。Webhook 端點在 Firestore 寫入 `market_prices/{market}_{ticker}` 並批次更新所有相符的 `holdings.currentPrice` / `priceAsOf`。

**理由**：與現有 `threads-scraper.yml` 完全一致的模式（GitHub Actions 只有 `CRON_SECRET`，不持有 Firebase Admin service account），降低憑證外洩面；且 tickers 是全站共用的市場資料，不需要按 userId 拆查。

**替代方案**：Python 直接用 Firebase Admin SDK 寫 Firestore（需把 service account JSON 放進 GitHub Secrets）。安全性較差，且與現有慣例不一致，故不採用。

### 3. 淨資產快照的「現金」維持手動輸入，不用累計現金流推算

**選擇**：`net_worth_snapshots` 的 `cashBalance` 由使用者在 Dashboard 手動輸入（比照銀行 App 看到的餘額自己填一個數字），系統只自動算 `investmentValue`（持股現值加總）與 `loanBalance`（`loans` 未結清餘額加總），三者組合成 `netWorth`。

**理由**：`accounting` 只記錄使用者「主動記帳」的支出/收入，實務上一定有沒被記到的金流（薪資入帳細節、朋友轉帳、ATM 提款等），累計推算會隨時間漂移失真。手動快照雖然要使用者自己動作，但符合 app 一貫「使用者主動記帳、系統輔助」的哲學，且用戶已明確表示「不用即時，大略知道就好」。

**替代方案**：`cashBalance` = 期初餘額 + Σ(Income − Expense)。放棄，因為漂移不可控且無法自我校正。

### 4. 美股市值換算台幣：複用 `fetchRateToTWD`，`market=US` 的 holding 即時換算

**選擇**：`holdings.currentPrice` 一律存「當地幣別」原始數字（TW 存 TWD，US 存 USD）。計算 `investmentValue`（用於淨資產快照）時，對 `market === "US"` 的 holding 呼叫 `fetchRateToTWD("USD")` 換算成台幣再加總；`market === "TW"` 直接相加。

**理由**：直接複用旅遊模式已驗證過的匯率工具，不用重新設計匯率快取機制；持股數量少（通常數十檔以內），即時抓匯率的呼叫量可接受。

### 5. Dashboard 投資交易表單提供「是否產生現金流紀錄」勾選，避免與既有 LINE 記帳重複計入

**選擇**：新增交易時預設勾選「同時記一筆 Investment 支出」（買入時金額 = `shares × pricePerShare + fee`，寫入 `accounting`，`tag: "Investment"`），賣出時**不提供此選項**（因為 `AccountingEntrySchema.amount` 只接受正數、且 `Investment` 標籤語意固定是支出方向，賣出的現金流入無法用現有 schema 正確表達，屬 Non-Goal）。表單旁加提示文字：「如果你已經用 LINE 記過這筆錢，請取消勾選，避免支出被重複計算」。

**理由**：這是本次唯一無法完全避免的重複計入風險（Dashboard 投資交易 vs LINE 快速記帳的 `Investment` 標籤是兩條獨立路徑，不強制合併，比照貸款功能允許 Dashboard 獨立於 LINE 記帳存在的先例），用 UI 提示讓使用者自行判斷，比自動去重（無法可靠比對兩筆是否為同一筆交易）更誠實。

## Implementation Contract

**行為**：
- Dashboard `/assets` 頁顯示四個區塊：現金流月度圖表（讀 `accounting`）、淨資產走勢折線圖（讀 `net_worth_snapshots`）、持股列表（讀 `holdings`，顯示股數/均價/現價/未實現損益，紅漲綠跌 — 沿用台股慣例）、貸款餘額卡片（讀 `loans`，複用信貸追蹤功能）
- 使用者可在 `/assets` 新增投資交易（買/賣）與記錄淨資產快照（輸入現金餘額，系統自動代入投資現值與貸款餘額）
- `stock-price-sync` 每日執行一次，更新 `holdings.currentPrice`；若某代號抓不到價格，`holdings.currentPrice` 保留上次成功值（stale-but-present），前端用 `priceAsOf` 判斷是否顯示「價格已 N 天未更新」提示

**資料形狀**：
```ts
InvestmentTransactionSchema = BaseEntrySchema.extend({
  market: z.enum(["TW", "US"]),
  ticker: z.string(),
  name: z.string().optional(),
  side: z.enum(["buy", "sell"]),
  shares: z.number().positive(),
  pricePerShare: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  date: z.string(), // YYYY-MM-DD
  linkedAccountingEntryId: z.string().optional(),
});

HoldingSchema = z.object({
  id: z.string().optional(), // `${userId}_${market}_${ticker}`
  userId: z.string(),
  market: z.enum(["TW", "US"]),
  ticker: z.string(),
  name: z.string().optional(),
  shares: z.number().nonnegative(),
  avgCost: z.number().nonnegative(),
  currentPrice: z.number().nonnegative().optional(),
  priceAsOf: z.string().optional(),
  updatedAt: z.any(),
});

NetWorthSnapshotSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  date: z.string(), // YYYY-MM-DD
  cashBalance: z.number(),
  investmentValueTWD: z.number(), // 系統算出，寫入時凍結
  loanBalance: z.number(),        // 系統算出，寫入時凍結
  netWorth: z.number(),
  createdAt: z.any(),
});
```

**API**：
- `GET/POST /api/holdings/transactions`、`GET /api/holdings`（彙總列表）
- `GET /api/holdings/tickers`（`Authorization: Bearer $CRON_SECRET`，回傳全站去重 `{market, ticker}[]`）
- `POST /api/webhook/stock-prices`（`Authorization: Bearer $CRON_SECRET`，body `{ prices: { market, ticker, price, asOfDate }[] }`）
- `GET/POST /api/net-worth`（快照列表 + 新增，`POST` 時伺服器端計算 `investmentValueTWD`/`loanBalance`，不信任前端傳來的值）
- `GET /api/dashboard/cashflow?months=12`（按月聚合，純讀取不落地）

**失敗模式**：
- `stock-price-sync` GitHub Actions 失敗 → `holdings.currentPrice` 維持舊值，UI 顯示「N 天未更新」而非報錯或清空
- 賣出股數 > 目前持股 → API 回 400，前端顯示錯誤，不寫入
- finlab 抓不到某代號（下市/非其涵蓋市場）→ 該代號略過，其餘正常寫入，`holdings.currentPrice` 為 `undefined` 時前端 fallback 顯示 `avgCost`（未實現損益顯示 0 + 「無最新股價」註記）

**驗收標準**：
- `yarn build` 通過、無新增 TypeScript `any`
- 手動建立一筆買入交易，確認 `holdings` 股數/均價正確、（勾選時）`accounting` 多一筆 `Investment` 支出
- 手動觸發 `services/stock-price-sync`（本地 `uv run` 或 workflow_dispatch），確認 `market_prices` 與相符 `holdings.currentPrice` 更新
- 手動建立一筆淨資產快照，確認 `investmentValueTWD`/`loanBalance` 是伺服器算出而非前端傳入值
- 現金流月度圖表數字與既有 `/accounting` 頁面的月度加總一致

**範圍邊界**：本次不動 `accounting`/`loans`/`recurring_expenses` 既有 schema 與行為；不修改既有 LINE `Investment` 記帳流程；不做已實現損益、不做非 TW/US 市場的自動股價。

## Risks / Trade-offs

- **[Dashboard 交易與 LINE 記帳重複計入現金流]** → 表單提示 + 預設行為由使用者控制（Decision 5），不做自動去重
- **[finlab 抓不到 / API 額度限制]** → 每日一次、只抓使用者實際持股（通常數十檔以內），失敗時 `holdings.currentPrice` 保留舊值不清空
- **[美股即時匯率呼叫量]** → 持股數量小，若未來量大可比照旅遊模式加短 TTL 快取
- **[使用者忘記定期記淨資產快照，走勢圖出現長空窗]** → 這是設計上刻意接受的取捨（手動優於自動漂移），Dashboard 可在快照超過 35 天未更新時顯示提醒（非本次強制要求，列入 tasks 的加分項）

## Migration Plan

1. 新 Firestore 集合皆為 schemaless 新增，不需要 migration script
2. `firestore.indexes.json` 不需新增項目（`holdings`/`net_worth_snapshots` 查詢均為單欄 `userId` 相等，client-side 排序，比照 `recurring_expenses`/`loans`/`budgets` 現況）
3. `services/stock-price-sync/` 獨立部署：新增 `.github/workflows/stock-price-sync.yml`，GitHub repo secrets 新增 `FINLAB_API_TOKEN`、`KANG_CORE_API_BASE_URL`（Kang-Core 部署網址；沿用既有 `CRON_SECRET`）
4. `/assets` 頁面上線即可用，不影響既有頁面；`middleware.ts` `PROTECTED_PATHS` 加入 `/assets`
5. 無 feature flag 需求；`stock-price-sync` 排程可用 `workflow_dispatch` 手動先跑一次驗證再排程上線

## Open Questions

- 已實現損益（賣出時的資本利得）要不要在下一版補上？如果要，`investment_transactions` 現有欄位已足夠回溯計算（FIFO 或移動平均），屬於 Dashboard 顯示層擴充，不影響本次 schema
- `holdings` 現值長期未更新（例如某代號已下市）要不要有「封存/隱藏」操作？本版沒有，使用者只能刪除該持股
