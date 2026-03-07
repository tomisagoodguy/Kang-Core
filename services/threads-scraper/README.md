# Threads Scraper 🧵

使用 Playwright 抓取 Meta Threads 公開貼文的工具，**不需要登入**。支援**排程自動抓取**和 **Webhook 通知**。

## 原理

Threads 頁面會在 `<script type="application/json" data-sjs>` 標籤中嵌入 JSON 資料，這個爬蟲透過 Playwright 載入頁面後，直接從 HTML 中解析這些隱藏的結構化資料，取得貼文內容、按讚數、回覆等資訊。

## 安裝

### 使用 uv（推薦）

```bash
# 安裝依賴
uv sync

# 安裝 Playwright 瀏覽器
uv run playwright install chromium
```

### 使用 pip

```bash
pip install -r requirements.txt
playwright install chromium
```

## 使用方式

### 基本抓取功能

#### 在 Python 中直接呼叫

```python
from src.core.scraper import ThreadsScraper

# 建立爬蟲實例
scraper = ThreadsScraper(headless=True)

# 抓取單篇貼文
data = scraper.scrape_thread("https://www.threads.net/t/XXXXX")
print(data["thread"]["text"])       # 貼文內容
print(data["thread"]["like_count"]) # 按讚數
print(data["replies"])              # 回覆列表

# 抓取用戶頁面
data = scraper.scrape_profile("https://www.threads.net/@username", max_posts=10)
print(data["profile"]["full_name"]) # 用戶名稱
print(data["profile"]["followers"]) # 追蹤者數
for t in data["threads"]:
    print(t["text"])
```

## 排程與自動搜尋 🤖

支援自動追蹤特定用戶、關鍵字、貼文回覆，並透過 Webhook 發送通知到 Discord、Slack 等平台。

### 設定檔

編輯 `config/config.yaml` 來設定要追蹤的目標：

```yaml
# 追蹤特定用戶
users:
  - username: "natgeo"
    max_posts: 10

# 追蹤特定貼文的回覆
threads:
  - url: "https://www.threads.net/t/XXXXX"
    check_replies: true

# 關鍵字篩選
keywords:
  - "AI"
  - "Claude"

# 排程設定（每天 09:00 執行）
schedule:
  daily_at: "09:00"

# 自動發現優質發文者
discovery:
  enabled: true
  min_like_count: 100        # 最低平均按讚數
  min_reply_count: 10        # 最低平均回覆數
  auto_track: true           # 自動加入追蹤

# Webhook 通知（支援 Discord / Slack / Telegram / LINE）
notifications:
  enabled: true
  webhooks:
    - url: "https://discord.com/api/webhooks/YOUR_WEBHOOK"
      type: "discord"
      name: "Threads 通知"
```

### 啟動服務

```bash
# 啟動排程器（持續運行，每天自動執行）
python run_scheduler.py start

# 或使用 uv
uv run python run_scheduler.py start

# 其他排程器指令
python run_scheduler.py run    # 立即執行一次（測試用）
python run_scheduler.py test   # 測試 Webhook 連線
python run_scheduler.py stats  # 查看資料庫統計

# 啟動 API 服務（查看抓取的資料）
python run_api.py

# API 文檔將在 http://localhost:8000/docs 提供
```

### FastAPI 查詢介面

專案包含完整的 REST API，可以查詢抓取的資料：

- 📊 **統計資訊**: `/api/stats` - 查看整體統計
- 📝 **貼文查詢**: `/api/posts` - 分頁、搜尋、過濾貼文
- 👤 **用戶資訊**: `/api/users` - 查看用戶及追蹤列表
- 📖 **API 文檔**: `/docs` - 完整的 Swagger UI

啟動 API 服務後，開啟瀏覽器訪問 http://localhost:8000/docs

### 功能特色

- ✅ **自動去重**：已抓取的貼文不會重複通知
- ✅ **SQLite 儲存**：所有資料結構化儲存，方便查詢
- ✅ **關鍵字過濾**：只通知包含特定關鍵字的貼文
- ✅ **多種通知方式**：支援 Discord、Slack、Telegram、LINE
- ✅ **追蹤回覆**：監控特定貼文是否有新回覆
- ✅ **彈性排程**：可設定每日執行時間
- 🆕 **自動發現用戶**：從熱門貼文中自動找到優質發文者並追蹤

### Webhook 設定範例

**Discord:**
1. 在 Discord 頻道設定中建立 Webhook
2. 複製 Webhook URL
3. 在 `config/config.yaml` 中加入：

```yaml
webhooks:
  - url: "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN"
    type: "discord"
    name: "Threads 通知"
```

**Slack:**
1. 建立 Slack App 並啟用 Incoming Webhooks
2. 複製 Webhook URL
3. 在 `config/config.yaml` 中加入：

```yaml
webhooks:
  - url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    type: "slack"
    name: "Threads 通知"
```

**Telegram:**
1. 在 Telegram 搜尋 `@BotFather` 並建立新 Bot，取得 Bot Token
2. 將 Bot 加入你的頻道或群組
3. 取得 Chat ID（可用 `@userinfobot` 或 `@getidsbot` 查詢）
4. 在 `config/config.yaml` 中加入：

```yaml
webhooks:
  - url: "YOUR_BOT_TOKEN"
    type: "telegram"
    name: "Threads 通知"
    chat_id: "YOUR_CHAT_ID"  # 你的 Chat ID 或群組 ID（負數代表群組）
```

**LINE Notify:**
1. 前往 [LINE Notify](https://notify-bot.line.me/) 登入
2. 點擊「發行權杖」，選擇要接收通知的聊天室
3. 複製產生的 Access Token
4. 在 `config/config.yaml` 中加入：

```yaml
webhooks:
  - url: "YOUR_LINE_NOTIFY_TOKEN"
    type: "line"
    name: "Threads 通知"
```

### 資料庫結構

**支援兩種資料庫：**

#### SQLite（開發/本地使用）
資料儲存在 `threads_data.db`，適合本地測試：

```python
from src.core.database_sqlite import ThreadsDatabase

db = ThreadsDatabase("threads_data.db")
stats = db.get_stats()
print(stats)
```

#### PostgreSQL（生產環境推薦）
使用環境變數 `DATABASE_URL` 設定：

```python
from src.core.database import ThreadsDatabase

# 會自動從 DATABASE_URL 讀取連線資訊
db = ThreadsDatabase()
stats = db.get_stats()
print(stats)
```

**資料表結構：**
- `users` - 用戶資料
- `posts` - 貼文資料
- `replies` - 回覆資料
- `tracking_log` - 追蹤記錄

## 自動發現優質發文者 🔍

系統會自動從已抓取的貼文中，找出高互動（高按讚數、高回覆數）的發文者，並自動加入追蹤列表。

### 工作原理

1. **分析現有資料**：從資料庫中統計每個用戶的平均互動數
2. **篩選優質用戶**：找出符合條件的用戶（可在 `config.yaml` 設定門檻）
3. **自動追蹤**：將發現的用戶加入自動追蹤列表
4. **持續監控**：定期抓取這些用戶的最新貼文
5. **智能清理**：自動移除長時間不活躍的用戶

### 設定門檻

在 `config/config.yaml` 中調整發現條件：

```yaml
discovery:
  enabled: true
  min_like_count: 100        # 平均按讚數至少 100
  min_reply_count: 10        # 平均回覆數至少 10
  min_posts: 3               # 至少有 3 篇貼文
  max_new_users_per_run: 10  # 每次最多發現 10 個新用戶
  auto_track: true           # 自動加入追蹤
  cleanup_inactive_days: 60  # 60 天未更新視為不活躍
```

### 手動管理追蹤用戶

```python
from src.core.database import ThreadsDatabase

db = ThreadsDatabase()

# 手動新增追蹤用戶
db.add_tracked_user("username", discovered_from="manual", max_posts=15)

# 查看所有追蹤中的用戶
tracked = db.get_tracked_users(active_only=True)
for user in tracked:
    print(f"@{user['username']} - 平均 {user['avg_like_count']} 讚")

# 移除追蹤用戶
db.remove_tracked_user("username", permanent=False)
```

### 查看發現報告

```bash
python run_scheduler.py stats

# 或使用 uv
uv run python run_scheduler.py stats
```

會顯示：
- 總追蹤用戶數
- 自動發現 vs 手動新增
- 平均互動數
- 表現最好的用戶排行

## 輸出格式

結果會存為 JSON 檔案，結構如下：

### 貼文 (post)
```json
{
  "thread": {
    "text": "貼文內容...",
    "published_on": 1718211770,
    "published_on_readable": "2024-06-12 12:34:56",
    "username": "natgeo",
    "like_count": 1401,
    "reply_count": 15,
    "images": [...],
    "videos": [...],
    "url": "https://www.threads.net/@natgeo/post/XXXXX"
  },
  "replies": [...]
}
```

### 用戶頁面 (profile)
```json
{
  "profile": {
    "username": "natgeo",
    "full_name": "National Geographic",
    "bio": "...",
    "followers": 12345678,
    "is_verified": true
  },
  "threads": [...]
}
```

## 防止被偵測為機器人 🛡️

系統內建多重防護機制，避免被 Threads 封鎖：

### 🔒 已實作的防護措施

1. **智能隨機延遲**
   - 每次請求之間隨機等待 3-10 秒
   - 模擬人類瀏覽行為

2. **請求頻率限制**
   - 預設每小時最多 20 個請求
   - 超過限制自動暫停並等待

3. **錯誤重試機制**
   - 失敗自動重試 3 次
   - 重試間隔 30 秒
   - 避免連續失敗請求

4. **真實瀏覽器模擬**
   - 使用 Playwright（真實 Chrome 瀏覽器）
   - 完整的 User-Agent
   - 自然的頁面載入行為

### ⚙️ 調整防護設定

在 `config/config.yaml` 中調整：

```yaml
advanced:
  # 隨機延遲設定（推薦開啟）
  random_delay: true
  random_delay_min: 3          # 最短等待 3 秒
  random_delay_max: 10         # 最長等待 10 秒

  # 請求頻率限制
  max_requests_per_hour: 20    # 每小時最多 20 次請求

  # 錯誤重試
  max_retries: 3               # 失敗重試 3 次
  retry_delay: 30              # 重試間隔 30 秒
```

### 💡 使用建議

| 使用情境 | 建議設定 |
|---------|---------|
| **安全模式** | `max_requests_per_hour: 15`，`random_delay_max: 15` |
| **平衡模式**（推薦） | `max_requests_per_hour: 20`，`random_delay_max: 10` |
| **快速模式**（風險較高） | `max_requests_per_hour: 30`，`random_delay_max: 5` |

### ⚠️ 注意事項

- ✅ 建議每天只執行 1-2 次排程
- ✅ 追蹤用戶數量控制在 50 個以內
- ✅ 開啟隨機延遲（`random_delay: true`）
- ⚠️ 不要在短時間內手動執行多次
- ⚠️ 避免追蹤過多用戶導致請求過多

## Docker 部署 🐳

### 快速開始（推薦）

使用 Docker Compose 一鍵部署完整服務（PostgreSQL + Scheduler + API）：

```bash
# 1. 複製環境變數範本
cp .env.example .env

# 2. 編輯 .env 設定你的參數（資料庫密碼、Webhook 等）
nano .env

# 3. 啟動所有服務
docker-compose up -d

# 4. 查看日誌
docker-compose logs -f scheduler
docker-compose logs -f api
```

服務啟動後：
- 📊 API 服務：http://localhost:8000
- 📖 API 文檔：http://localhost:8000/docs
- 🗄️ PostgreSQL：localhost:5432

### 管理指令

```bash
# 重啟服務
docker-compose restart scheduler

# 立即執行一次抓取
docker-compose exec scheduler python run_scheduler.py run

# 查看統計
docker-compose exec scheduler python run_scheduler.py stats

# 停止服務
docker-compose down

# 停止並刪除資料
docker-compose down -v
```

**詳細說明請參考：**
- Docker 部署指南：[docker/README.md](docker/README.md)
- Zeabur 雲端部署：[docs/DEPLOY.md](docs/DEPLOY.md)

## 專案結構 📁

```
threads-scraper/
├── src/                      # 主程式碼
│   ├── core/                # 核心模組
│   │   ├── scraper.py       # Threads 爬蟲邏輯
│   │   ├── database.py      # PostgreSQL 資料庫
│   │   ├── database_sqlite.py # SQLite 資料庫
│   │   └── config_loader.py # 配置載入器
│   ├── features/            # 功能模組
│   │   ├── scheduler.py     # 排程器
│   │   ├── discovery.py     # 用戶發現
│   │   └── notifier.py      # Webhook 通知
│   └── api/                 # REST API
│       ├── app.py           # FastAPI 應用
│       └── routes/          # API 路由
│           ├── posts.py     # 貼文查詢
│           ├── users.py     # 用戶查詢
│           └── stats.py     # 統計資訊
├── config/                  # 配置檔案
│   └── config.yaml          # 主配置檔
├── docker/                  # Docker 相關
│   ├── Dockerfile           # Docker 映像
│   └── README.md            # Docker 使用說明
├── docs/                    # 文檔
│   ├── DEPLOY.md            # 部署指南
│   └── EXPLORE.md           # 探索功能說明
├── run_api.py               # API 服務啟動腳本
├── run_scheduler.py         # 排程器啟動腳本
├── docker-compose.yml       # Docker Compose 配置
├── .env.example             # 環境變數範本
└── README.md                # 本文件
```

## 環境變數配置 ⚙️

專案支援使用環境變數覆蓋 `config/config.yaml` 的設定。

複製 `.env.example` 為 `.env` 並編輯：

```bash
cp .env.example .env
```

**主要環境變數：**

```bash
# 資料庫（PostgreSQL）
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# 追蹤設定
TRACKED_USERS=user1,user2,user3
KEYWORDS=AI,程式設計,科技

# 探索模式
EXPLORE_ENABLED=true
EXPLORE_MAX_SCROLLS=3

# 自動發現
DISCOVERY_ENABLED=true
DISCOVERY_MIN_LIKE_COUNT=100

# Webhook 通知
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
LINE_NOTIFY_TOKEN=YOUR_LINE_TOKEN
```

完整列表請參考 [.env.example](.env.example)。

## 注意事項

- 只能抓取**公開**的貼文和個人資料
- Threads 頁面結構可能隨時變動，如果爬蟲失敗，可能需要更新解析邏輯
- 請合理控制抓取頻率，避免對伺服器造成負擔
- 本工具僅供學習和研究用途

## 相關連結 🔗

- 📖 [Docker 部署指南](docker/README.md)
- 🚀 [Zeabur 雲端部署](docs/DEPLOY.md)
- 🔍 [探索功能說明](docs/EXPLORE.md)
- 💡 [建議追蹤帳號](docs/SUGGESTED_ACCOUNTS.md)
