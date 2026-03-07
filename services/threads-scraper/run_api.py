#!/usr/bin/env python3
"""
FastAPI 服務啟動腳本
執行: python run_api.py
或: uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload
"""

import sys
import os

# 將專案根目錄加入 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn


def main():
    """啟動 FastAPI 服務"""
    print("🚀 啟動 Threads Scraper API...")
    print("📖 API 文件: http://localhost:8000/docs")
    print("🔍 健康檢查: http://localhost:8000/health")
    print("\n按 Ctrl+C 停止服務\n")

    uvicorn.run(
        "src.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


if __name__ == "__main__":
    main()
