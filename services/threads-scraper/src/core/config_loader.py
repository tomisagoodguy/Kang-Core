"""
配置載入器 - 支援從環境變數或 config.yaml 載入設定
"""

import os
import yaml
from typing import Dict, Any


def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    """
    載入配置，優先使用環境變數

    Args:
        config_path: config.yaml 的路徑

    Returns:
        配置字典
    """
    # 1. 先載入 config.yaml（如果存在）
    config = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

    # 2. 環境變數覆蓋配置

    # 資料庫路徑
    if os.getenv("DATABASE_PATH"):
        if "database" not in config:
            config["database"] = {}
        config["database"]["path"] = os.getenv("DATABASE_PATH")

    # 追蹤用戶
    if os.getenv("TRACKED_USERS"):
        users = os.getenv("TRACKED_USERS").split(",")
        config["users"] = [{"username": u.strip(), "max_posts": 10} for u in users if u.strip()]

    # 關鍵字
    if os.getenv("KEYWORDS"):
        keywords = os.getenv("KEYWORDS").split(",")
        config["keywords"] = [k.strip() for k in keywords if k.strip()]

    # 探索模式
    if os.getenv("EXPLORE_ENABLED"):
        if "explore" not in config:
            config["explore"] = {}
        config["explore"]["enabled"] = os.getenv("EXPLORE_ENABLED", "false").lower() == "true"
        if os.getenv("EXPLORE_MAX_SCROLLS"):
            config["explore"]["max_scrolls"] = int(os.getenv("EXPLORE_MAX_SCROLLS", "3"))

    # 自動發現
    if os.getenv("DISCOVERY_ENABLED"):
        if "discovery" not in config:
            config["discovery"] = {}
        config["discovery"]["enabled"] = os.getenv("DISCOVERY_ENABLED", "false").lower() == "true"
        if os.getenv("DISCOVERY_MIN_LIKE_COUNT"):
            config["discovery"]["min_like_count"] = int(os.getenv("DISCOVERY_MIN_LIKE_COUNT", "100"))

    # Webhooks
    webhooks = []

    # Discord
    if os.getenv("DISCORD_WEBHOOK_URL"):
        webhooks.append({
            "url": os.getenv("DISCORD_WEBHOOK_URL"),
            "type": "discord",
            "name": "Discord 通知"
        })

    # Slack
    if os.getenv("SLACK_WEBHOOK_URL"):
        webhooks.append({
            "url": os.getenv("SLACK_WEBHOOK_URL"),
            "type": "slack",
            "name": "Slack 通知"
        })

    # Telegram
    if os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID"):
        webhooks.append({
            "url": os.getenv("TELEGRAM_BOT_TOKEN"),
            "type": "telegram",
            "name": "Telegram 通知",
            "chat_id": os.getenv("TELEGRAM_CHAT_ID")
        })

    # LINE
    if os.getenv("LINE_NOTIFY_TOKEN"):
        webhooks.append({
            "url": os.getenv("LINE_NOTIFY_TOKEN"),
            "type": "line",
            "name": "LINE 通知"
        })

    if webhooks:
        if "notifications" not in config:
            config["notifications"] = {}
        config["notifications"]["enabled"] = True
        config["notifications"]["webhooks"] = webhooks

    return config


def get_database_path() -> str:
    """取得資料庫路徑"""
    return os.getenv("DATABASE_PATH", "threads_data.db")
