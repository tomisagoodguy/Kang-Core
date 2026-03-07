# Zeabur 部署指南 🚀

本指南將教您如何將 Threads Scraper 部署到 Zeabur 雲端平台。

## 📋 前置需求

1. GitHub 帳號
2. Zeabur 帳號（https://zeabur.com）
3. 專案已推送到 GitHub

## 🎯 部署步驟

### 1. 登入 Zeabur

前往 https://zeabur.com 並使用 GitHub 帳號登入。

### 2. 創建新專案

1. 點擊 **「Create Project」**
2. 輸入專案名稱：`threads-scraper`
3. 選擇區域（建議選擇離您最近的）

### 3. 部署服務

1. 點擊 **「Add Service」**
2. 選擇 **「Git」**
3. 選擇您的 Repository：`vincentxuwork/threads-scraper`
4. Zeabur 會自動偵測到 Dockerfile 並開始建置

### 4. 部署兩個服務

**重要：** 建議部署兩個獨立服務：

#### 服務 1：Scheduler（排程器）
- 用途：自動抓取貼文
- Dockerfile CMD：`["python", "run_scheduler.py"]`
- 持續運行

#### 服務 2：API Server（選配）
- 用途：查看抓取的資料
- Dockerfile CMD：`["python", "run_api.py"]`
- 需要啟用 Port 綁定（Port 8000）

### 5. 設定環境變數

在**兩個服務**的設定中，點擊 **「Variables」** 標籤，新增以下環境變數：

#### 必要變數（使用 PostgreSQL 時）

```
# PostgreSQL URL（Zeabur 會自動注入此變數如果你添加了 PostgreSQL 服務）
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

#### 或使用 SQLite（不推薦）

```
DATABASE_PATH=/data/threads_data.db
```

#### 追蹤設定

```
# 追蹤的用戶（逗號分隔）
TRACKED_USERS=user1,user2,user3

# 關鍵字（逗號分隔）
KEYWORDS=AI,Claude,程式設計
```

#### 探索模式

```
EXPLORE_ENABLED=true
EXPLORE_MAX_SCROLLS=3
```

#### 自動發現

```
DISCOVERY_ENABLED=true
DISCOVERY_MIN_LIKE_COUNT=100
```

#### 通知設定（選擇一種或多種）

**Discord:**
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
```

**Slack:**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Telegram:**
```
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
```

**LINE:**
```
LINE_NOTIFY_TOKEN=YOUR_LINE_TOKEN
```

### 6. 設定資料庫

#### ⭐ 選項 A：使用 PostgreSQL（強烈推薦）

1. 在 Zeabur 專案中點擊 **「Add Service」**
2. 選擇 **「Database」** → **「PostgreSQL」**
3. Zeabur 會自動創建 PostgreSQL 實例
4. `DATABASE_URL` 環境變數會自動注入到所有服務
5. **無需額外設定**，程式會自動使用 PostgreSQL

**優點：**
- ✅ 資料持久化
- ✅ 多個服務共享資料
- ✅ 自動備份
- ✅ 更好的性能

#### 選項 B：使用 SQLite + Volume（僅測試用）

**不建議在生產環境使用**，因為：
- ❌ Volume 在不同服務間無法共享
- ❌ 服務重啟可能丟失資料
- ❌ API 和 Scheduler 無法共用資料庫

如果仍要使用：
1. 在服務設定中，找到 **「Volumes」**
2. 點擊 **「Add Volume」**
3. Mount Path：`/data`
4. Size：1GB
5. 設定環境變數：`DATABASE_PATH=/data/threads_data.db`

### 7. 設定排程執行

Scheduler 服務使用內建排程功能，會根據 `config.yaml` 設定自動執行。

在 `config/config.yaml` 中設定：
```yaml
schedule:
  daily_at: "09:00"  # 每天 09:00 執行
```

服務會持續運行並在指定時間自動抓取。

### 8. 啟用 API 服務（選配）

如果部署了 API 服務：

1. 在服務設定中找到 **「Networking」**
2. 啟用 **「Port Binding」**
3. Port：`8000`
4. Zeabur 會自動生成公開 URL
5. 訪問 `https://your-service.zeabur.app/docs` 查看 API 文檔

### 9. 部署完成

Zeabur 會自動：
1. 偵測到 Dockerfile
2. 建置 Docker 映像
3. 部署容器
4. 啟動服務

**架構圖：**
```
┌─────────────────┐
│   PostgreSQL    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌──▼─────┐
│Scheduler│ │API (8000)│
│(Worker) │ │(Web)   │
└─────────┘ └────────┘
```

---

## 📊 監控與管理

### 查看日誌

1. 進入您的服務
2. 點擊 **「Logs」** 標籤
3. 即時查看執行日誌

### 查看統計

#### 方式 1：使用 API（推薦）

訪問 API 服務：
- `GET /api/stats` - 整體統計
- `GET /api/posts` - 查看貼文
- `GET /api/users` - 查看用戶
- `GET /docs` - 完整 API 文檔

#### 方式 2：使用 Console

在 Zeabur Console 中：

```bash
# 立即執行一次抓取
python run_scheduler.py run

# 查看統計
python run_scheduler.py stats

# 測試 Webhook
python run_scheduler.py test
```

---

## 🔧 故障排除

### 問題 1：Playwright 安裝失敗

**解決方法：**
檢查 Dockerfile 是否正確安裝系統依賴。

### 問題 2：資料庫無法寫入

**解決方法：**
確保已設定 Volume 並掛載到 `/data`。

### 問題 3：記憶體不足

**解決方法：**
1. 減少 `EXPLORE_MAX_SCROLLS`（改為 2）
2. 升級 Zeabur 方案

### 問題 4：服務一直重啟

**解決方法：**
檢查日誌，可能是：
- 環境變數設定錯誤
- config.yaml 格式錯誤
- 缺少必要依賴

---

## 💰 成本估算

### Zeabur 定價

- **Developer Plan**：$5/月
  - 適合個人使用
  - 有資源限制

- **Team Plan**：$20/月
  - 更多資源
  - 更穩定

### 資源需求

本專案預估需求：
- CPU：0.5 Core
- Memory：512MB - 1GB
- Storage：1GB（資料庫）
- Bandwidth：最小

---

## 🎯 最佳實踐

### 1. 合理設定執行頻率

```
# 建議每天執行 1-2 次
schedule:
  daily_at: "09:00"
```

### 2. 控制抓取範圍

```
# 不要追蹤太多用戶
TRACKED_USERS=user1,user2,user3  # 5-10 個為宜

# 適當的探索深度
EXPLORE_MAX_SCROLLS=3  # 不要超過 5
```

### 3. 監控資源使用

定期檢查 Zeabur 的資源使用情況，避免超額。

### 4. 備份資料

定期從 Volume 下載資料庫備份。

---

## 🔄 更新部署

當您更新程式碼後：

1. 推送到 GitHub：
   ```bash
   git add .
   git commit -m "更新功能"
   git push
   ```

2. Zeabur 會自動偵測並重新部署

---

## 📚 相關連結

- Zeabur 文件：https://zeabur.com/docs
- Zeabur Discord：https://discord.gg/zeabur
- 專案 GitHub：https://github.com/vincentxuwork/threads-scraper

---

## 🆘 需要幫助？

- GitHub Issues：https://github.com/vincentxuwork/threads-scraper/issues
- Zeabur 支援：support@zeabur.com

---

## ✅ 部署檢查清單

部署前請確認：

- [ ] GitHub Repository 已設定
- [ ] Zeabur 帳號已創建
- [ ] 環境變數已設定
- [ ] Volume 已掛載
- [ ] Webhook 已測試
- [ ] 排程時間已設定

部署後請檢查：

- [ ] 服務正常運行
- [ ] 日誌無錯誤
- [ ] 資料庫可寫入
- [ ] 通知正常發送
- [ ] 抓取功能正常

---

Happy Deploying! 🚀
