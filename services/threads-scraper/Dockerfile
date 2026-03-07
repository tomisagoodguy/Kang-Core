# 使用 Python 3.11 官方映像
FROM python:3.11-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴（Playwright 需要）
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 安裝 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 複製專案檔案
COPY pyproject.toml ./

# 安裝 Python 依賴(使用 pyproject.toml)
RUN uv pip install --system -e .

# 安裝 Playwright 瀏覽器
RUN playwright install chromium

# 複製所有專案檔案
COPY . .

# 複製並設定啟動腳本權限
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 創建資料目錄
RUN mkdir -p /data

# 設定環境變數
ENV PYTHONUNBUFFERED=1
ENV DATABASE_PATH=/data/threads_data.db
ENV SERVICE_TYPE=scheduler

# 使用 entrypoint 腳本
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
