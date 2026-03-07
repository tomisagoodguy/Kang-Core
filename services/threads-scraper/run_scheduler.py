#!/usr/bin/env python3
"""
排程器啟動腳本

使用方式:
  python run_scheduler.py [command]

指令:
  start (預設)  - 啟動排程器（持續運行）
  run          - 立即執行一次（測試用）
  test         - 測試 Webhook 連線
  stats        - 查看資料庫統計
"""

import sys
import os

# 將專案根目錄加入 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.features.scheduler import ThreadsScheduler


def show_help():
    """顯示幫助訊息"""
    print(__doc__)


def main():
    # 讀取命令參數
    command = sys.argv[1] if len(sys.argv) > 1 else "start"

    # 顯示幫助
    if command in ["-h", "--help", "help"]:
        show_help()
        return

    try:
        scheduler = ThreadsScheduler("config/config.yaml")

        if command == "start":
            # 啟動排程器（持續運行）
            scheduler.run_forever()

        elif command == "run":
            # 立即執行一次
            print("\n▶️  執行單次抓取...\n")
            scheduler.run_once()
            print("\n✅ 執行完成！")

        elif command == "test":
            # 測試 Webhook
            print("\n🧪 測試 Webhook 連線...\n")
            scheduler.test_webhooks()

        elif command == "stats":
            # 顯示統計
            scheduler.show_stats()

        else:
            print(f"❌ 未知指令: {command}")
            print("   執行 'python run_scheduler.py --help' 查看可用指令")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n👋 程式已停止")
    except Exception as e:
        print(f"❌ 發生錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
