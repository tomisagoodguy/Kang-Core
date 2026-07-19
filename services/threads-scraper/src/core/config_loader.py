"""
配置載入器 - 支援從環境變數或 config.yaml 載入設定
"""

import os
import yaml
from typing import Dict, Any, cast


def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    """
    載入配置，優先使用環境變數

    Args:
        config_path: config.yaml 的路徑

    Returns:
        配置字典
    """
    # 1. 先載入 config.yaml（如果存在）
    config: Dict[str, Any] = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f)
            if isinstance(loaded, dict):
                config = cast(Dict[str, Any], loaded)

    # 2. 環境變數覆蓋配置

    # 資料庫路徑
    db_path = os.getenv("DATABASE_PATH")
    if db_path:
        if "database" not in config:
            config["database"] = {}
        config["database"]["path"] = db_path

    # 追蹤用戶
    tracked_users = os.getenv("TRACKED_USERS")
    if tracked_users:
        users = tracked_users.split(",")
        config["users"] = [{"username": u.strip(), "max_posts": 10} for u in users if u.strip()]

    # 關鍵字
    keywords_env = os.getenv("KEYWORDS")
    if keywords_env:
        keywords = keywords_env.split(",")
        config["keywords"] = [k.strip() for k in keywords if k.strip()]

    # 探索模式
    explore_enabled = os.getenv("EXPLORE_ENABLED")
    if explore_enabled:
        if "explore" not in config:
            config["explore"] = {}
        config["explore"]["enabled"] = explore_enabled.lower() == "true"
        
        explore_max = os.getenv("EXPLORE_MAX_SCROLLS")
        if explore_max:
            config["explore"]["max_scrolls"] = int(explore_max)

    # 自動發現
    discovery_enabled = os.getenv("DISCOVERY_ENABLED")
    if discovery_enabled:
        if "discovery" not in config:
            config["discovery"] = {}
        config["discovery"]["enabled"] = discovery_enabled.lower() == "true"
        
        discovery_min = os.getenv("DISCOVERY_MIN_LIKE_COUNT")
        if discovery_min:
            config["discovery"]["min_like_count"] = int(discovery_min)

    # Webhooks
    webhooks = []

    # Discord
    discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")
    if discord_webhook:
        webhooks.append({
            "url": discord_webhook,
            "type": "discord",
            "name": "Discord 通知"
        })

    # Slack
    slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
    if slack_webhook:
        webhooks.append({
            "url": slack_webhook,
            "type": "slack",
            "name": "Slack 通知"
        })

    # Telegram
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
    tg_chat = os.getenv("TELEGRAM_CHAT_ID")
    if tg_token and tg_chat:
        webhooks.append({
            "url": tg_token,
            "type": "telegram",
            "name": "Telegram 通知",
            "chat_id": tg_chat
        })

    # LINE
    line_token = os.getenv("LINE_NOTIFY_TOKEN")
    if line_token:
        webhooks.append({
            "url": line_token,
            "type": "line",
            "name": "LINE 通知"
        })

    # Kang-Core Next.js Webhook（優先使用環境變數）
    kang_webhook = os.getenv("KANG_CORE_WEBHOOK_URL")
    if kang_webhook:
        # 移除 config.yaml 中的 localhost webhook，換成正式環境
        if "notifications" in config and "webhooks" in config["notifications"]:
            config["notifications"]["webhooks"] = [
                w for w in config["notifications"]["webhooks"]
                if "localhost" not in w.get("url", "")
            ]
        webhooks.append({
            "url": kang_webhook,
            "type": "generic",
            "name": "Kang-Core Production",
            # /api/webhooks/threads 需要 Bearer CRON_SECRET 驗證（2026-06-07 起）
            "auth_token": os.getenv("CRON_SECRET"),
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
