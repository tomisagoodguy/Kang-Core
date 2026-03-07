## Context

目前專案已經有了一個以 Firestore 為核心儲存的架構，並透過 Next.js 處理各種前端需求與 API。
現在我們希望加入 `@vincentxuwork/threads-scraper` 這個獨立的 Python 工具來爬取 Threads 貼文，將社群媒體監控整合成我們自動化工作流的一部分。這個小工具透過排程運行，可以直接向指定的 Webhook 傳送資料。

## Goals / Non-Goals

**Goals:**

- 將 Python 爬蟲微服務化處理。
- 透過 Webhook 在不破壞現有 Next.js 架構的情況下進行跨系統整合。
- 保證傳入的資料型別安全（透過 Zod `ThreadsEntrySchema` 驗證）。
- 整合推播，把收到並記錄的資料同時發送到使用者既有的 LINE Bot 上。

**Non-Goals:**

- 完整重寫 Python 爬蟲為 TypeScript 版本（成本太高且未來難與原作者同步）。
- 直接在 Python 爬蟲端實作 Firestore 寫入規則（避免分散認證、破壞主體架構封裝原則）。

## Decisions

1. **Python 作為獨立的子程序 / 微服務**
   把 `threads-scraper` 放進 `services/threads-scraper`，並保留其 `pyproject.toml` 及使用 `uv` 管理環境。這樣做最大程度地保留了原專案的獨立性與升級彈性，也能透過容器或 PM2 等工具輕易擴展。
2. **基於 HTTP Webhook 的系統通訊**
   選用 Next.js 的 App Router 定義一個特定的端點 `POST /api/webhooks/threads`。該端點會負責接收從 Python 爬出來的單筆 Threads Data。
   爬蟲端的 `config.yaml` 中會將通知用 URL 寫死為這個剛建立的本機端點（或對外網址）。
3. **Data Pipeline 與持久化**
   接收到資料後，會透過剛加入的 `ThreadsEntrySchema` 定義進行解析並處理可能的格式不符。安全解析完成後，寫入 Firestore 的 `entries` 中。
4. **現有的 LINE Service 作為 Sink**
   由於現有架構中已經有 `line.service.ts`，當 Firestore 寫入成功後，立刻使用 `LineService.pushMessage` (或其他既有發送方法)，將爬取進來的貼文以文字卡片的形式直接送給 User，統一推送介面。

## Risks / Trade-offs

- **Risk: Python 環境依賴問題** → **Mitigation**: 使用 `uv` 並要求在 Server 啟動時擁有獨立的環境執行腳本；或提供 Dockerfile 針對此服務包裹。
- **Risk: Webhook 格式改變** → **Mitigation**: 利用 Zod Schema `ThreadsEntrySchema` 做嚴格把關，一旦 `threads-scraper` 改變輸出格式會立刻觸發錯誤並留下記錄，不會產生 Invalid Data污染 Firebase。
- **Risk: API rate limiting** → **Mitigation**: 爬蟲本身的排程已能控制送出量，Webhook 也應保留短時間內接收大量單筆的擴展能力，必要時加入 Queue。

## Migration Plan

不需要大規模 Migration，但需要開啟兩地的服務：

1. Next.js 開發伺服器 (`yarn dev`)
2. 啟動 `uv run python run_scheduler.py start`
3. 加入環境變數與正確的 Config（將目標 Webhook 指向 Next.js URL）。
