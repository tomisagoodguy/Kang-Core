# Docker 部署指南

## 🚀 快速開始

### 1. 使用 Docker Compose（推薦）

在專案根目錄下執行：

```bash
# 複製環境變數範本
cp .env.example .env

# 編輯 .env 設定你的參數
nano .env

# 啟動所有服務（PostgreSQL + Scheduler + API）
docker-compose up -d

# 查看日誌
docker-compose logs -f scheduler
docker-compose logs -f api

# 停止服務
docker-compose down

# 停止並刪除資料
docker-compose down -v
```

服務啟動後：
- 📊 API 服務：http://localhost:8000
- 📖 API 文檔：http://localhost:8000/docs
- 🗄️ PostgreSQL：localhost:5432

### 2. 單獨使用 Docker

```bash
# 建置映像
docker build -f docker/Dockerfile -t threads-scraper .

# 運行排程器
docker run -d \
  --name threads-scheduler \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e DISCORD_WEBHOOK_URL="..." \
  threads-scraper

# 運行 API
docker run -d \
  --name threads-api \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  threads-scraper python run_api.py
```

## 📋 服務說明

### PostgreSQL
- 映像：`postgres:15-alpine`
- Port：5432
- 資料持久化：使用 Docker Volume

### Scheduler（排程器）
- 持續運行，根據 config.yaml 定時抓取
- 自動連接 PostgreSQL
- 支援環境變數覆蓋設定

### API（查詢服務）
- Port：8000
- 提供 REST API 查詢抓取的資料
- 完整的 Swagger UI 文檔

## 🔧 環境變數

所有環境變數都定義在 `.env` 檔案中：

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `DB_PASSWORD` | PostgreSQL 密碼 | `change_me_in_production` |
| `TRACKED_USERS` | 追蹤用戶列表 | - |
| `KEYWORDS` | 關鍵字列表 | - |
| `DISCORD_WEBHOOK_URL` | Discord Webhook | - |

完整列表請參考 `.env.example`。

## 📊 管理指令

```bash
# 重啟服務
docker-compose restart scheduler
docker-compose restart api

# 查看統計（需要進入容器）
docker-compose exec scheduler python run_scheduler.py stats

# 立即執行一次抓取
docker-compose exec scheduler python run_scheduler.py run

# 測試 Webhook
docker-compose exec scheduler python run_scheduler.py test

# 進入 PostgreSQL
docker-compose exec postgres psql -U threads_user -d threads_scraper

# 備份資料庫
docker-compose exec postgres pg_dump -U threads_user threads_scraper > backup.sql

# 恢復資料庫
cat backup.sql | docker-compose exec -T postgres psql -U threads_user threads_scraper
```

## 🔒 安全建議

1. **修改預設密碼**：務必在 `.env` 中設定強密碼
2. **不要提交 .env**：已加入 `.gitignore`
3. **限制 Port 綁定**：生產環境中可以不暴露 PostgreSQL Port
4. **使用 Secrets**：生產環境建議使用 Docker Secrets

## 🐛 故障排除

### 服務無法啟動

```bash
# 檢查日誌
docker-compose logs scheduler
docker-compose logs api
docker-compose logs postgres

# 檢查服務狀態
docker-compose ps

# 重建映像
docker-compose build --no-cache
```

### 資料庫連線失敗

確保 PostgreSQL 健康檢查通過：
```bash
docker-compose ps postgres
# 狀態應顯示 "healthy"
```

### Port 衝突

如果 5432 或 8000 Port 已被佔用，修改 `docker-compose.yml`：
```yaml
ports:
  - "5433:5432"  # 改為 5433
  - "8001:8000"  # 改為 8001
```

## 📦 部署到雲端

### Zeabur
直接使用專案的 `docker-compose.yml`，Zeabur 會自動識別並部署。

### Railway / Render
類似方式，這些平台都支援 Docker Compose。

### 自己的 VPS
```bash
# 複製專案到伺服器
git clone https://github.com/vincentxuwork/threads-scraper.git
cd threads-scraper

# 設定環境變數
cp .env.example .env
nano .env

# 啟動
docker-compose up -d
```
