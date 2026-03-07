"""
通知模組 - 支援 Webhook 通知（Discord, Slack, Telegram, LINE 等）
"""

import json
from typing import Dict, List
import requests


class Notifier:
    def __init__(self, webhooks: List[Dict], notify_on: Dict):
        """
        初始化通知器

        Args:
            webhooks: Webhook 設定列表
            notify_on: 通知條件設定
        """
        self.webhooks = webhooks
        self.notify_on = notify_on

    def send_new_posts(self, posts: List[Dict], keywords: List[str] = None):
        """發送新貼文通知"""
        if not self.notify_on.get("new_posts", True):
            return

        for post in posts:
            # 檢查是否符合關鍵字條件
            has_keyword = False
            matched_keywords = []

            if keywords:
                text = (post.get("text") or "").lower()
                for kw in keywords:
                    if kw.lower() in text:
                        has_keyword = True
                        matched_keywords.append(kw)

            # 如果設定了關鍵字通知，但沒有配對到，則跳過
            if keywords and self.notify_on.get("keyword_match", True) and not has_keyword:
                continue

            self._send_post_notification(post, matched_keywords)

    def send_new_replies(self, replies: List[Dict]):
        """發送新回覆通知"""
        if not self.notify_on.get("new_replies", True):
            return

        for reply in replies:
            self._send_reply_notification(reply)

    def _send_post_notification(self, post: Dict, keywords: List[str] = None):
        """發送單篇貼文通知"""
        for webhook in self.webhooks:
            webhook_type = webhook.get("type", "generic")
            url = webhook.get("url")

            if not url:
                continue

            try:
                if webhook_type == "discord":
                    self._send_discord_post(url, post, keywords)
                elif webhook_type == "slack":
                    self._send_slack_post(url, post, keywords)
                elif webhook_type == "telegram":
                    self._send_telegram_post(url, post, keywords, webhook)
                elif webhook_type == "line":
                    self._send_line_post(url, post, keywords)
                else:
                    self._send_generic_post(url, post, keywords)
            except Exception as e:
                print(f"⚠️  發送通知失敗 ({webhook.get('name', 'Unknown')}): {e}")

    def _send_reply_notification(self, reply: Dict):
        """發送單則回覆通知"""
        for webhook in self.webhooks:
            webhook_type = webhook.get("type", "generic")
            url = webhook.get("url")

            if not url:
                continue

            try:
                if webhook_type == "discord":
                    self._send_discord_reply(url, reply)
                elif webhook_type == "slack":
                    self._send_slack_reply(url, reply)
                elif webhook_type == "telegram":
                    self._send_telegram_reply(url, reply, webhook)
                elif webhook_type == "line":
                    self._send_line_reply(url, reply)
                else:
                    self._send_generic_reply(url, reply)
            except Exception as e:
                print(f"⚠️  發送通知失敗 ({webhook.get('name', 'Unknown')}): {e}")

    def _send_discord_post(self, url: str, post: Dict, keywords: List[str] = None):
        """發送 Discord 格式的貼文通知"""
        text = post.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        # 建立標籤
        tags = []
        if keywords:
            tags.append(f"🏷️ 關鍵字: {', '.join(keywords)}")
        if post.get("has_images"):
            tags.append("🖼️ 圖片")
        if post.get("has_videos"):
            tags.append("🎥 影片")

        embed = {
            "title": f"🆕 新貼文 - @{post.get('username')}",
            "description": truncated_text,
            "url": post.get("url"),
            "color": 5814783,  # Threads 紫色
            "fields": [
                {
                    "name": "發佈時間",
                    "value": post.get("published_on_readable", "未知"),
                    "inline": True
                },
                {
                    "name": "互動數",
                    "value": f"❤️ {post.get('like_count', 0)} | 💬 {post.get('reply_count', 0)}",
                    "inline": True
                }
            ],
            "footer": {
                "text": "Threads Scraper"
            }
        }

        if tags:
            embed["fields"].insert(0, {
                "name": "標籤",
                "value": " | ".join(tags),
                "inline": False
            })

        payload = {"embeds": [embed]}
        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_discord_reply(self, url: str, reply: Dict):
        """發送 Discord 格式的回覆通知"""
        text = reply.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        embed = {
            "title": f"💬 新回覆 - @{reply.get('username')}",
            "description": truncated_text,
            "url": reply.get("parent_url"),
            "color": 3447003,  # 藍色
            "fields": [
                {
                    "name": "回覆時間",
                    "value": reply.get("published_on_readable", "未知"),
                    "inline": True
                },
                {
                    "name": "按讚數",
                    "value": f"❤️ {reply.get('like_count', 0)}",
                    "inline": True
                }
            ],
            "footer": {
                "text": "Threads Scraper"
            }
        }

        payload = {"embeds": [embed]}
        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_slack_post(self, url: str, post: Dict, keywords: List[str] = None):
        """發送 Slack 格式的貼文通知"""
        text = post.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        tags = []
        if keywords:
            tags.append(f"🏷️ *關鍵字:* {', '.join(keywords)}")
        if post.get("has_images"):
            tags.append("🖼️ 圖片")
        if post.get("has_videos"):
            tags.append("🎥 影片")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🆕 新貼文 - @{post.get('username')}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": truncated_text
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"⏰ {post.get('published_on_readable', '未知')} | ❤️ {post.get('like_count', 0)} | 💬 {post.get('reply_count', 0)}"
                    }
                ]
            }
        ]

        if tags:
            blocks.insert(1, {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": " | ".join(tags)
                    }
                ]
            })

        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "查看貼文"
                    },
                    "url": post.get("url")
                }
            ]
        })

        payload = {"blocks": blocks}
        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_slack_reply(self, url: str, reply: Dict):
        """發送 Slack 格式的回覆通知"""
        text = reply.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"💬 新回覆 - @{reply.get('username')}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": truncated_text
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"⏰ {reply.get('published_on_readable', '未知')} | ❤️ {reply.get('like_count', 0)}"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "查看原貼文"
                        },
                        "url": reply.get("parent_url")
                    }
                ]
            }
        ]

        payload = {"blocks": blocks}
        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_generic_post(self, url: str, post: Dict, keywords: List[str] = None):
        """發送通用 JSON 格式的貼文通知"""
        payload = {
            "type": "new_post",
            "post": {
                "id": post.get("id"),
                "username": post.get("username"),
                "text": post.get("text"),
                "url": post.get("url"),
                "published_on": post.get("published_on_readable"),
                "like_count": post.get("like_count", 0),
                "reply_count": post.get("reply_count", 0),
                "has_images": post.get("has_images", False),
                "has_videos": post.get("has_videos", False),
            }
        }

        if keywords:
            payload["matched_keywords"] = keywords

        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_generic_reply(self, url: str, reply: Dict):
        """發送通用 JSON 格式的回覆通知"""
        payload = {
            "type": "new_reply",
            "reply": {
                "id": reply.get("id"),
                "username": reply.get("username"),
                "text": reply.get("text"),
                "parent_url": reply.get("parent_url"),
                "published_on": reply.get("published_on_readable"),
                "like_count": reply.get("like_count", 0),
            }
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_telegram_post(self, bot_token: str, post: Dict, keywords: List[str], webhook: Dict):
        """發送 Telegram 格式的貼文通知"""
        chat_id = webhook.get("chat_id")
        if not chat_id:
            raise ValueError("Telegram webhook 需要設定 chat_id")

        text = post.get("text", "")
        truncated_text = text[:300] + "..." if len(text) > 300 else text

        # 建立標籤
        tags = []
        if keywords:
            tags.append(f"🏷️ 關鍵字: {', '.join(keywords)}")
        if post.get("has_images"):
            tags.append("🖼️")
        if post.get("has_videos"):
            tags.append("🎥")

        # 組合訊息（使用 Telegram MarkdownV2 或 HTML）
        message = f"""🆕 <b>新貼文</b> - @{post.get('username')}

{truncated_text}

⏰ {post.get('published_on_readable', '未知')}
❤️ {post.get('like_count', 0)} | 💬 {post.get('reply_count', 0)}
"""

        if tags:
            message += f"\n{' '.join(tags)}"

        message += f"\n\n<a href=\"{post.get('url')}\">查看貼文</a>"

        # Telegram Bot API
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": False
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_telegram_reply(self, bot_token: str, reply: Dict, webhook: Dict):
        """發送 Telegram 格式的回覆通知"""
        chat_id = webhook.get("chat_id")
        if not chat_id:
            raise ValueError("Telegram webhook 需要設定 chat_id")

        text = reply.get("text", "")
        truncated_text = text[:300] + "..." if len(text) > 300 else text

        message = f"""💬 <b>新回覆</b> - @{reply.get('username')}

{truncated_text}

⏰ {reply.get('published_on_readable', '未知')}
❤️ {reply.get('like_count', 0)}

<a href=\"{reply.get('parent_url')}\">查看原貼文</a>
"""

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": False
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

    def _send_line_post(self, access_token: str, post: Dict, keywords: List[str]):
        """發送 LINE Notify 格式的貼文通知"""
        text = post.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        # 建立標籤
        tags = []
        if keywords:
            tags.append(f"🏷️ 關鍵字: {', '.join(keywords)}")
        if post.get("has_images"):
            tags.append("🖼️")
        if post.get("has_videos"):
            tags.append("🎥")

        message = f"""🆕 新貼文 - @{post.get('username')}

{truncated_text}

⏰ {post.get('published_on_readable', '未知')}
❤️ {post.get('like_count', 0)} | 💬 {post.get('reply_count', 0)}
"""

        if tags:
            message += f"\n{' '.join(tags)}"

        message += f"\n\n{post.get('url')}"

        # LINE Notify API
        url = "https://notify-api.line.me/api/notify"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        payload = {
            "message": message
        }

        response = requests.post(url, headers=headers, data=payload)
        response.raise_for_status()

    def _send_line_reply(self, access_token: str, reply: Dict):
        """發送 LINE Notify 格式的回覆通知"""
        text = reply.get("text", "")
        truncated_text = text[:200] + "..." if len(text) > 200 else text

        message = f"""💬 新回覆 - @{reply.get('username')}

{truncated_text}

⏰ {reply.get('published_on_readable', '未知')}
❤️ {reply.get('like_count', 0)}

{reply.get('parent_url')}
"""

        url = "https://notify-api.line.me/api/notify"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        payload = {
            "message": message
        }

        response = requests.post(url, headers=headers, data=payload)
        response.raise_for_status()

    def test_connection(self):
        """測試 Webhook 連線"""
        print("\n🧪 測試 Webhook 連線...")
        for webhook in self.webhooks:
            name = webhook.get("name", "Unknown")
            webhook_type = webhook.get("type", "generic")
            url = webhook.get("url")

            if not url:
                print(f"  ⚠️  {name}: 未設定 URL")
                continue

            try:
                # 發送測試訊息
                if webhook_type == "discord":
                    payload = {
                        "embeds": [{
                            "title": "✅ 測試通知",
                            "description": "Threads Scraper Webhook 連線成功！",
                            "color": 5814783
                        }]
                    }
                    response = requests.post(url, json=payload, timeout=10)
                    response.raise_for_status()

                elif webhook_type == "slack":
                    payload = {
                        "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "✅ *測試通知*\n\nThreads Scraper Webhook 連線成功！"
                            }
                        }]
                    }
                    response = requests.post(url, json=payload, timeout=10)
                    response.raise_for_status()

                elif webhook_type == "telegram":
                    chat_id = webhook.get("chat_id")
                    if not chat_id:
                        print(f"  ⚠️  {name}: 缺少 chat_id 設定")
                        continue

                    telegram_url = f"https://api.telegram.org/bot{url}/sendMessage"
                    payload = {
                        "chat_id": chat_id,
                        "text": "✅ <b>測試通知</b>\n\nThreads Scraper Webhook 連線成功！",
                        "parse_mode": "HTML"
                    }
                    response = requests.post(telegram_url, json=payload, timeout=10)
                    response.raise_for_status()

                elif webhook_type == "line":
                    line_url = "https://notify-api.line.me/api/notify"
                    headers = {
                        "Authorization": f"Bearer {url}"
                    }
                    payload = {
                        "message": "✅ 測試通知\n\nThreads Scraper Webhook 連線成功！"
                    }
                    response = requests.post(line_url, headers=headers, data=payload, timeout=10)
                    response.raise_for_status()

                else:
                    payload = {
                        "type": "test",
                        "message": "Threads Scraper Webhook 連線成功！"
                    }
                    response = requests.post(url, json=payload, timeout=10)
                    response.raise_for_status()

                print(f"  ✅ {name} ({webhook_type}): 連線成功")
            except Exception as e:
                print(f"  ❌ {name} ({webhook_type}): 連線失敗 - {e}")
