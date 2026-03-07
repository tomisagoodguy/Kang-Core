#!/bin/bash
set -e

# 根據 SERVICE_TYPE 環境變數決定啟動哪個服務
case "${SERVICE_TYPE}" in
  "scheduler")
    echo "🚀 啟動 Scheduler 服務..."
    exec python run_scheduler.py start
    ;;
  "api")
    echo "🚀 啟動 API 服務..."
    exec python run_api.py
    ;;
  *)
    echo "⚠️  未設定 SERVICE_TYPE 環境變數，預設啟動 Scheduler"
    exec python run_scheduler.py start
    ;;
esac
