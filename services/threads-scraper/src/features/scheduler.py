"""
排程主程式 - 自動抓取 Threads 貼文並發送通知
"""

import time
import yaml
import random
import re
from datetime import datetime, timedelta
from typing import Dict, List
import schedule

from src.core.scraper import scrape_thread, scrape_profile, scrape_explore, scrape_search
from src.core.database import ThreadsDatabase
from src.features.notifier import Notifier
from src.features.discovery import UserDiscovery
from src.core.config_loader import load_config


class ThreadsScheduler:
    def __init__(self, config_path: str = "config.yaml"):
        """初始化排程器"""
        print("🚀 初始化 Threads Scraper 排程器...")

        # 載入設定檔（支援環境變數）
        self.config = load_config(config_path)

        # 初始化資料庫
        # ThreadsDatabase 會自動處理 PostgreSQL (DATABASE_URL) 或 SQLite 回退
        import os
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            # 使用 PostgreSQL
            self.db = ThreadsDatabase(db_url)
        else:
            # 回退到 SQLite
            from src.core.database_sqlite import ThreadsDatabase as SQLiteDB
            db_path = self.config.get("database", {}).get("path", "threads_data.db")
            self.db = SQLiteDB(db_path)

        # 初始化通知器
        notifications = self.config.get("notifications", {})
        if notifications.get("enabled", True):
            webhooks = notifications.get("webhooks", [])
            notify_on = notifications.get("notify_on", {})
            self.notifier = Notifier(webhooks, notify_on)
        else:
            self.notifier = None

        # 讀取設定
        self.users = self.config.get("users") or []
        self.threads = self.config.get("threads") or []
        self.keywords = self.config.get("keywords") or []
        self.explore_config = self.config.get("explore") or {}
        self.advanced = self.config.get("advanced") or {}

        # 請求計數器（用於限制請求頻率）
        self.request_count = 0
        self.request_window_start = datetime.now()

        # 初始化用戶發現器
        discovery_config = self.config.get("discovery", {})
        if discovery_config.get("enabled", True):
            self.discovery = UserDiscovery(self.db, discovery_config)
        else:
            self.discovery = None

        print(f"✅ 排程器初始化完成")
        print(f"   📊 手動追蹤 {len(self.users)} 個用戶")
        print(f"   🧵 追蹤 {len(self.threads)} 篇貼文")
        print(f"   🔍 監控 {len(self.keywords)} 個關鍵字")
        if self.explore_config.get("enabled", False):
            print(f"   🌍 探索模式: 啟用")
        if self.discovery:
            tracked = self.db.get_tracked_users(active_only=True)
            print(f"   🤖 自動追蹤 {len(tracked)} 個用戶")

    def _smart_delay(self):
        """智能延遲（模擬人類行為）"""
        if self.advanced.get("random_delay", True):
            min_delay = self.advanced.get("random_delay_min", 3)
            max_delay = self.advanced.get("random_delay_max", 10)
            delay = random.uniform(min_delay, max_delay)
            print(f"   ⏳ 延遲 {delay:.1f} 秒...")
            time.sleep(delay)
        else:
            delay = self.advanced.get("delay_between_requests", 5)
            if delay > 0:
                time.sleep(delay)

    def _check_rate_limit(self) -> bool:
        """
        檢查請求頻率限制

        Returns:
            是否可以繼續請求
        """
        max_requests = self.advanced.get("max_requests_per_hour", 20)

        # 如果超過 1 小時，重置計數器
        if datetime.now() - self.request_window_start > timedelta(hours=1):
            self.request_count = 0
            self.request_window_start = datetime.now()

        # 檢查是否超過限制
        if self.request_count >= max_requests:
            wait_time = 3600 - (datetime.now() - self.request_window_start).seconds
            print(f"\n⚠️  已達每小時請求上限 ({max_requests} 次)")
            print(f"   將在 {wait_time // 60} 分鐘後繼續...")
            return False

        return True

    def _scrape_with_retry(self, scrape_func, *args, **kwargs):
        """
        帶重試機制的抓取

        Args:
            scrape_func: 抓取函數
            *args, **kwargs: 傳遞給抓取函數的參數

        Returns:
            抓取結果或 None
        """
        max_retries = self.advanced.get("max_retries", 3)
        retry_delay = self.advanced.get("retry_delay", 30)

        for attempt in range(max_retries):
            try:
                result = scrape_func(*args, **kwargs)
                self.request_count += 1
                return result
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"   ⚠️  抓取失敗 (嘗試 {attempt + 1}/{max_retries}): {e}")
                    print(f"   ⏳ {retry_delay} 秒後重試...")
                    time.sleep(retry_delay)
                else:
                    print(f"   ❌ 已達最大重試次數，跳過此項目")
                    return None

    def run_scrape_job(self):
        """執行一次完整的抓取任務"""
        print(f"\n{'='*60}")
        print(f"🕐 開始執行抓取任務 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")

        # 重置請求計數器
        self.request_count = 0
        self.request_window_start = datetime.now()

        total_new_posts = 0
        total_new_replies = 0

        # 1. 合併手動設定和自動追蹤的用戶
        users_to_scrape = []

        # 手動設定的用戶
        for user_config in self.users:
            users_to_scrape.append({
                "username": user_config.get("username"),
                "max_posts": user_config.get("max_posts", 10),
                "source": "manual"
            })

        # 自動追蹤的用戶
        if self.discovery:
            tracked_users = self.db.get_tracked_users(active_only=True)
            for tracked in tracked_users:
                # 避免重複
                if tracked["username"] not in [u["username"] for u in users_to_scrape]:
                    users_to_scrape.append({
                        "username": tracked["username"],
                        "max_posts": tracked.get("max_posts", 10),
                        "source": "auto"
                    })

        print(f"📋 準備抓取 {len(users_to_scrape)} 個用戶")
        print(f"   手動: {sum(1 for u in users_to_scrape if u['source'] == 'manual')}")
        print(f"   自動: {sum(1 for u in users_to_scrape if u['source'] == 'auto')}\n")

        # 2. 抓取探索頁面（如果啟用）
        if self.explore_config.get("enabled", False):
            print("🌍 抓取探索頁面（發現新貼文）...\n")

            try:
                max_scrolls = self.explore_config.get("max_scrolls", 3)
                headless = self.advanced.get("headless", True)

                explore_data = self._scrape_with_retry(
                    scrape_explore,
                    headless=headless,
                    max_scrolls=max_scrolls
                )

                if explore_data:
                    explore_posts = explore_data.get("explore_posts", [])
                    new_explore_count = 0
                    skipped_count = 0

                    # 儲存探索貼文（只保存符合關鍵字的）
                    for post in explore_posts:
                        # 檢查是否符合關鍵字（使用全詞匹配）
                        should_save = True
                        if self.keywords:
                            text = post.get("text") or ""
                            has_keyword = False
                            matched_keywords = []

                            for kw in self.keywords:
                                # 使用全詞匹配（\b 表示詞邊界）
                                pattern = r'\b' + re.escape(kw) + r'\b'
                                if re.search(pattern, text, re.IGNORECASE):
                                    has_keyword = True
                                    matched_keywords.append(kw)

                            should_save = has_keyword

                            if has_keyword:
                                print(f"   🎯 發現關鍵字貼文: @{post.get('username')} (匹配: {', '.join(matched_keywords)})")
                            else:
                                skipped_count += 1

                        # 只保存符合條件的貼文
                        if should_save:
                            success, is_new = self.db.save_post(post)
                            if success and is_new:
                                new_explore_count += 1

                            # 如果貼文互動數高，嘗試從中發現用戶
                            if self.discovery and post.get("like_count", 0) >= self.discovery.config.get("min_like_count", 100):
                                self.discovery.discover_from_post(post)

                    total_new_posts += new_explore_count

                    if self.keywords:
                        print(f"   ✅ 探索頁面: {len(explore_posts)} 篇貼文，{new_explore_count} 篇符合關鍵字並保存，{skipped_count} 篇已略過")
                    else:
                        print(f"   ✅ 探索頁面: {len(explore_posts)} 篇貼文，{new_explore_count} 篇為新貼文")

                    # 記錄日誌
                    self.db.log_tracking(
                        "explore", "homepage",
                        len(explore_posts), new_explore_count, "success"
                    )

                    # 智能延遲
                    self._smart_delay()

            except Exception as e:
                print(f"   ❌ 探索頁面抓取失敗: {e}")
                self.db.log_tracking("explore", "homepage", 0, 0, f"error: {e}")

        # 3. 抓取追蹤用戶的貼文
        for user_info in users_to_scrape:
            # 檢查請求頻率限制
            if not self._check_rate_limit():
                print("   ⏸️  暫停抓取以遵守頻率限制")
                break

            username = user_info.get("username")
            max_posts = user_info.get("max_posts", 10)
            source = user_info.get("source", "manual")

            if not username:
                continue

            source_emoji = "📌" if source == "manual" else "🤖"
            print(f"{source_emoji} 抓取用戶: @{username}")

            # 使用帶重試的抓取
            url = f"https://www.threads.net/@{username}"
            headless = self.advanced.get("headless", True)
            data = self._scrape_with_retry(scrape_profile, url, headless=headless)

            if not data:
                self.db.log_tracking("user", username, 0, 0, "error: max retries")
                continue

            try:

                # 儲存用戶資料
                if data.get("profile"):
                    self.db.save_user(data["profile"])

                # 儲存貼文（只保存符合關鍵字的）
                threads = data.get("threads", [])[:max_posts]
                new_count = 0
                skipped_count = 0

                for thread in threads:
                    # 檢查是否符合關鍵字（使用全詞匹配）
                    should_save = True
                    if self.keywords:
                        text = thread.get("text") or ""
                        has_keyword = False

                        for kw in self.keywords:
                            # 使用全詞匹配（\b 表示詞邊界）
                            pattern = r'\b' + re.escape(kw) + r'\b'
                            if re.search(pattern, text, re.IGNORECASE):
                                has_keyword = True
                                break

                        should_save = has_keyword

                        if not has_keyword:
                            skipped_count += 1

                    # 只保存符合條件的貼文
                    if should_save:
                        success, is_new = self.db.save_post(thread)
                        if success and is_new:
                            new_count += 1

                total_new_posts += new_count

                # 顯示結果
                if self.keywords and skipped_count > 0:
                    print(f"   ✅ {len(threads)} 篇貼文，{new_count} 篇符合關鍵字並保存，{skipped_count} 篇已略過")
                else:
                    print(f"   ✅ {len(threads)} 篇貼文，{new_count} 篇為新貼文")

                # 記錄日誌
                self.db.log_tracking(
                    "user", username,
                    len(threads), new_count, "success"
                )

                print(f"   ✅ 找到 {len(threads)} 篇貼文，{new_count} 篇為新貼文")

                # 如果是自動追蹤的用戶，更新統計資訊
                if source == "auto":
                    self.db.update_tracked_user_stats(username)

                # 智能延遲
                self._smart_delay()

            except Exception as e:
                print(f"   ❌ 抓取失敗: {e}")
                self.db.log_tracking("user", username, 0, 0, f"error: {e}")

        # 4. 搜尋關鍵字
        if self.keywords:
            print(f"\n🔍 開始搜尋關鍵字（共 {len(self.keywords)} 個）...\n")

            for keyword in self.keywords:
                # 檢查請求頻率限制
                if not self._check_rate_limit():
                    print("   ⏸️  暫停搜尋以遵守頻率限制")
                    break

                print(f"🔎 搜尋關鍵字: {keyword}")

                # 使用帶重試的抓取
                headless = self.advanced.get("headless", True)
                max_scrolls = self.explore_config.get("max_scrolls", 3)

                search_data = self._scrape_with_retry(
                    scrape_search,
                    keyword,
                    headless=headless,
                    max_scrolls=max_scrolls
                )

                if not search_data:
                    self.db.log_tracking("keyword", keyword, 0, 0, "error: max retries")
                    continue

                try:
                    # 儲存搜尋結果
                    posts = search_data.get("posts", [])
                    new_count = 0

                    for post in posts:
                        success, is_new = self.db.save_post(post)
                        if success and is_new:
                            new_count += 1

                        # 如果貼文互動數高，嘗試從中發現用戶
                        if self.discovery and post.get("like_count", 0) >= self.discovery.config.get("min_like_count", 100):
                            self.discovery.discover_from_post(post)

                    total_new_posts += new_count

                    print(f"   ✅ 找到 {len(posts)} 篇貼文，{new_count} 篇為新貼文")

                    # 記錄日誌
                    self.db.log_tracking(
                        "keyword", keyword,
                        len(posts), new_count, "success"
                    )

                    # 智能延遲
                    self._smart_delay()

                except Exception as e:
                    print(f"   ❌ 搜尋失敗: {e}")
                    self.db.log_tracking("keyword", keyword, 0, 0, f"error: {e}")

        # 5. 自動發現新用戶
        if self.discovery and total_new_posts > 0:
            new_discovered = self.discovery.discover_from_database()
            if new_discovered:
                print(f"\n🎉 自動發現了 {len(new_discovered)} 個新用戶！")

        # 6. 抓取追蹤貼文的回覆
        for thread_config in self.threads:
            # 檢查請求頻率限制
            if not self._check_rate_limit():
                print("   ⏸️  暫停抓取以遵守頻率限制")
                break

            thread_url = thread_config.get("url")
            check_replies = thread_config.get("check_replies", True)

            if not thread_url or not check_replies:
                continue

            print(f"🧵 抓取貼文回覆: {thread_url}")

            # 使用帶重試的抓取
            headless = self.advanced.get("headless", True)
            data = self._scrape_with_retry(scrape_thread, thread_url, headless=headless)

            if not data:
                self.db.log_tracking("post", thread_url, 0, 0, "error: max retries")
                continue

            try:

                # 儲存主貼文
                main_thread = data.get("thread")
                if main_thread:
                    self.db.save_post(main_thread)
                    post_id = main_thread.get("id")

                    # 儲存回覆
                    replies = data.get("replies", [])
                    new_reply_count = 0

                    for reply in replies:
                        success, is_new = self.db.save_reply(reply, post_id)
                        if success and is_new:
                            new_reply_count += 1

                    total_new_replies += new_reply_count

                    # 記錄日誌
                    self.db.log_tracking(
                        "post", post_id,
                        len(replies), new_reply_count, "success"
                    )

                    print(f"   ✅ 找到 {len(replies)} 則回覆，{new_reply_count} 則為新回覆")

                # 智能延遲
                self._smart_delay()

            except Exception as e:
                print(f"   ❌ 抓取失敗: {e}")
                self.db.log_tracking("post", thread_url, 0, 0, f"error: {e}")

        # 7. 清理不活躍用戶
        if self.discovery:
            cleanup_days = self.discovery.config.get("cleanup_inactive_days", 60)
            self.discovery.cleanup_inactive_users(days=cleanup_days)

        # 8. 發送通知
        if self.notifier and (total_new_posts > 0 or total_new_replies > 0):
            print(f"\n📢 發送通知...")

            # 發送新貼文通知
            if total_new_posts > 0:
                unnotified_posts = self.db.get_unnotified_posts(self.keywords)
                if unnotified_posts:
                    self.notifier.send_new_posts(unnotified_posts, self.keywords)
                    post_ids = [p["id"] for p in unnotified_posts]
                    self.db.mark_as_notified(post_ids, is_reply=False)
                    print(f"   ✅ 已通知 {len(unnotified_posts)} 篇新貼文")

            # 發送新回覆通知
            if total_new_replies > 0:
                unnotified_replies = self.db.get_unnotified_replies()
                if unnotified_replies:
                    self.notifier.send_new_replies(unnotified_replies)
                    reply_ids = [r["id"] for r in unnotified_replies]
                    self.db.mark_as_notified(reply_ids, is_reply=True)
                    print(f"   ✅ 已通知 {len(unnotified_replies)} 則新回覆")

        # 9. 顯示統計資訊
        stats = self.db.get_stats()
        print(f"\n📊 資料庫統計:")
        print(f"   總用戶數: {stats['total_users']}")
        print(f"   總貼文數: {stats['total_posts']}")
        print(f"   總回覆數: {stats['total_replies']}")
        print(f"   近 24h 貼文: {stats['posts_last_24h']}")

        print(f"\n✅ 抓取任務完成")
        print(f"{'='*60}\n")

    def setup_schedule(self):
        """設定排程"""
        schedule_config = self.config.get("schedule", {})
        daily_at = schedule_config.get("daily_at", "09:00")

        # 設定每日執行時間
        schedule.every().day.at(daily_at).do(self.run_scrape_job)

        print(f"⏰ 已設定排程: 每天 {daily_at} 執行")
        print(f"   下次執行時間: {schedule.next_run()}\n")

    def run_once(self):
        """立即執行一次（不使用排程）"""
        self.run_scrape_job()

    def run_forever(self):
        """持續執行排程"""
        self.setup_schedule()

        print("🔄 排程器開始運行...")
        print("   按 Ctrl+C 可停止\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # 每分鐘檢查一次
        except KeyboardInterrupt:
            print("\n\n👋 排程器已停止")

    def test_webhooks(self):
        """測試 Webhook 連線"""
        if self.notifier:
            self.notifier.test_connection()
        else:
            print("⚠️  通知功能未啟用")

    def show_stats(self):
        """顯示資料庫統計"""
        stats = self.db.get_stats()
        print("\n📊 資料庫統計:")
        print(f"   總用戶數: {stats['total_users']}")
        print(f"   總貼文數: {stats['total_posts']}")
        print(f"   總回覆數: {stats['total_replies']}")
        print(f"   近 24h 貼文: {stats['posts_last_24h']}\n")

        # 顯示自動追蹤統計
        if self.discovery:
            self.discovery.print_report()


def main():
    """CLI 入口"""
    import sys

    usage = """
使用方式:
    python scheduler.py run          立即執行一次抓取
    python scheduler.py start        啟動排程（持續運行）
    python scheduler.py test         測試 Webhook 連線
    python scheduler.py stats        顯示資料庫統計

範例:
    python scheduler.py run          # 立即抓取一次
    python scheduler.py start        # 啟動每日排程
    """

    if len(sys.argv) < 2:
        print(usage)
        sys.exit(1)

    command = sys.argv[1]

    try:
        scheduler = ThreadsScheduler()

        if command == "run":
            scheduler.run_once()
        elif command == "start":
            scheduler.run_forever()
        elif command == "test":
            scheduler.test_webhooks()
        elif command == "stats":
            scheduler.show_stats()
        else:
            print(f"❌ 未知指令: {command}")
            print(usage)
            sys.exit(1)

    except FileNotFoundError:
        print("❌ 找不到 config.yaml，請先建立設定檔")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
