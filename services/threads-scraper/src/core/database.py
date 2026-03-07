"""
資料庫模組 - 使用 PostgreSQL 儲存 Threads 貼文資料（雲端部署）
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ThreadsDatabase:
    def __init__(self, db_url: str = None):
        """
        初始化資料庫連線

        Args:
            db_url: PostgreSQL 連線字串，如 postgresql://user:pass@host:port/dbname
                   如果不提供，會依序嘗試：
                   1. 環境變數 DATABASE_URL
                   2. 降級使用 SQLite（開發模式）
        """
        self.db_url = db_url or os.getenv("DATABASE_URL")

        # 如果沒有 PostgreSQL URL，降級使用 SQLite
        if not self.db_url:
            print("⚠️  未設定 DATABASE_URL，使用 SQLite（本地開發模式）")
            from src.core.database_sqlite import ThreadsDatabase as SQLiteDB
            self.__class__ = SQLiteDB
            self.__init__(os.getenv("DATABASE_PATH", "threads_data.db"))
            return

        self.init_database()

    def get_connection(self):
        """取得資料庫連線"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)

    def init_database(self):
        """初始化資料庫，建立必要的資料表"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # 用戶資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                full_name TEXT,
                bio TEXT,
                followers INTEGER,
                is_verified BOOLEAN,
                profile_pic TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 貼文資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                username TEXT,
                text TEXT,
                published_on BIGINT,
                published_on_readable TEXT,
                like_count INTEGER,
                reply_count INTEGER,
                url TEXT,
                has_images BOOLEAN,
                has_videos BOOLEAN,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT false
            )
        """)

        # 回覆資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS replies (
                id TEXT PRIMARY KEY,
                parent_post_id TEXT,
                username TEXT,
                text TEXT,
                published_on BIGINT,
                published_on_readable TEXT,
                like_count INTEGER,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT false
            )
        """)

        # 追蹤記錄表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracking_log (
                id SERIAL PRIMARY KEY,
                target_type TEXT,
                target_id TEXT,
                tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                posts_found INTEGER,
                new_posts INTEGER,
                status TEXT
            )
        """)

        # 自動追蹤用戶表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracked_users (
                username TEXT PRIMARY KEY,
                discovered_from TEXT,
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                max_posts INTEGER DEFAULT 10,
                avg_like_count REAL,
                avg_reply_count REAL,
                total_posts_scraped INTEGER DEFAULT 0,
                last_scraped TIMESTAMP,
                notes TEXT
            )
        """)

        # 建立索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_username ON posts(username)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_on)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_post_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracked_users_active ON tracked_users(is_active)")

        conn.commit()
        conn.close()

    def save_user(self, profile: Dict) -> bool:
        """儲存或更新用戶資料"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO users (username, full_name, bio, followers, is_verified, profile_pic, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (username) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    bio = EXCLUDED.bio,
                    followers = EXCLUDED.followers,
                    is_verified = EXCLUDED.is_verified,
                    profile_pic = EXCLUDED.profile_pic,
                    last_updated = CURRENT_TIMESTAMP
            """, (
                profile.get("username"),
                profile.get("full_name"),
                profile.get("bio"),
                profile.get("followers"),
                profile.get("is_verified", False),
                profile.get("profile_pic"),
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"❌ 儲存用戶資料失敗: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def save_post(self, post: Dict) -> tuple[bool, bool]:
        """儲存貼文資料"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT id FROM posts WHERE id = %s", (post.get("id"),))
            existing = cursor.fetchone()
            is_new = existing is None

            cursor.execute("""
                INSERT INTO posts
                (id, username, text, published_on, published_on_readable,
                 like_count, reply_count, url, has_images, has_videos, scraped_at, notified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, false)
                ON CONFLICT (id) DO UPDATE SET
                    like_count = EXCLUDED.like_count,
                    reply_count = EXCLUDED.reply_count,
                    scraped_at = CURRENT_TIMESTAMP
            """, (
                post.get("id"), post.get("username"), post.get("text"),
                post.get("published_on"), post.get("published_on_readable"),
                post.get("like_count", 0), post.get("reply_count", 0),
                post.get("url"), bool(post.get("images")), bool(post.get("videos"))
            ))
            conn.commit()
            return True, is_new
        except Exception as e:
            print(f"❌ 儲存貼文失敗: {e}")
            conn.rollback()
            return False, False
        finally:
            conn.close()

    def save_reply(self, reply: Dict, parent_post_id: str) -> tuple[bool, bool]:
        """儲存回覆資料"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT id FROM replies WHERE id = %s", (reply.get("id"),))
            existing = cursor.fetchone()
            is_new = existing is None

            cursor.execute("""
                INSERT INTO replies
                (id, parent_post_id, username, text, published_on,
                 published_on_readable, like_count, scraped_at, notified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, false)
                ON CONFLICT (id) DO UPDATE SET
                    like_count = EXCLUDED.like_count,
                    scraped_at = CURRENT_TIMESTAMP
            """, (
                reply.get("id"), parent_post_id, reply.get("username"),
                reply.get("text"), reply.get("published_on"),
                reply.get("published_on_readable"), reply.get("like_count", 0)
            ))
            conn.commit()
            return True, is_new
        except Exception as e:
            print(f"❌ 儲存回覆失敗: {e}")
            conn.rollback()
            return False, False
        finally:
            conn.close()

    def get_unnotified_posts(self, keywords: Optional[List[str]] = None) -> List[Dict]:
        """取得尚未通知的新貼文"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT * FROM posts
                WHERE notified = false
                ORDER BY published_on DESC
            """)
            posts = [dict(row) for row in cursor.fetchall()]

            if keywords:
                filtered = []
                for post in posts:
                    text = (post.get("text") or "").lower()
                    if any(kw.lower() in text for kw in keywords):
                        filtered.append(post)
                return filtered

            return posts
        finally:
            conn.close()

    def get_unnotified_replies(self) -> List[Dict]:
        """取得尚未通知的新回覆"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT r.*, p.url as parent_url
                FROM replies r
                JOIN posts p ON r.parent_post_id = p.id
                WHERE r.notified = false
                ORDER BY r.published_on DESC
            """)
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def mark_as_notified(self, post_ids: List[str], is_reply: bool = False):
        """標記貼文或回覆為已通知"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            table = "replies" if is_reply else "posts"
            cursor.execute(f"""
                UPDATE {table}
                SET notified = true
                WHERE id = ANY(%s)
            """, (post_ids,))
            conn.commit()
        finally:
            conn.close()

    def log_tracking(self, target_type: str, target_id: str,
                    posts_found: int, new_posts: int, status: str):
        """記錄追蹤日誌"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO tracking_log
                (target_type, target_id, posts_found, new_posts, status)
                VALUES (%s, %s, %s, %s, %s)
            """, (target_type, target_id, posts_found, new_posts, status))
            conn.commit()
        finally:
            conn.close()

    def get_stats(self) -> Dict:
        """取得資料庫統計資訊"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT COUNT(*) as count FROM users")
            total_users = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM posts")
            total_posts = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM replies")
            total_replies = cursor.fetchone()['count']

            cursor.execute("""
                SELECT COUNT(*) as count FROM posts
                WHERE scraped_at > NOW() - INTERVAL '1 day'
            """)
            posts_last_24h = cursor.fetchone()['count']

            return {
                "total_users": total_users,
                "total_posts": total_posts,
                "total_replies": total_replies,
                "posts_last_24h": posts_last_24h,
            }
        finally:
            conn.close()

    def cleanup_old_data(self, days: int = 30):
        """清理舊資料"""
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                DELETE FROM posts
                WHERE scraped_at < NOW() - INTERVAL '%s days'
            """, (days,))

            cursor.execute("""
                DELETE FROM replies
                WHERE scraped_at < NOW() - INTERVAL '%s days'
            """, (days,))

            deleted = cursor.rowcount
            conn.commit()
            return deleted
        finally:
            conn.close()

    # ── 自動追蹤用戶管理（同SQLite版本，只需改參數格式）────

    def add_tracked_user(self, username: str, discovered_from: str = "manual",
                        max_posts: int = 10, notes: str = None) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT username FROM tracked_users WHERE username = %s", (username,))
            if cursor.fetchone():
                print(f"   ℹ️  @{username} 已在追蹤列表中")
                return False

            cursor.execute("""
                INSERT INTO tracked_users (username, discovered_from, max_posts, notes)
                VALUES (%s, %s, %s, %s)
            """, (username, discovered_from, max_posts, notes))
            conn.commit()
            print(f"   ✅ 已加入追蹤: @{username}")
            return True
        except Exception as e:
            print(f"   ❌ 新增追蹤用戶失敗: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_tracked_users(self, active_only: bool = True) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            if active_only:
                cursor.execute("""
                    SELECT * FROM tracked_users
                    WHERE is_active = true
                    ORDER BY last_scraped ASC NULLS FIRST
                """)
            else:
                cursor.execute("SELECT * FROM tracked_users ORDER BY discovered_at DESC")
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def update_tracked_user_stats(self, username: str):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT AVG(like_count) as avg_likes, AVG(reply_count) as avg_replies, COUNT(*) as total_posts
                FROM posts WHERE username = %s
            """, (username,))
            result = cursor.fetchone()
            if result:
                cursor.execute("""
                    UPDATE tracked_users
                    SET avg_like_count = %s, avg_reply_count = %s, total_posts_scraped = %s, last_scraped = CURRENT_TIMESTAMP
                    WHERE username = %s
                """, (result['avg_likes'] or 0, result['avg_replies'] or 0, result['total_posts'], username))
                conn.commit()
        finally:
            conn.close()

    def remove_tracked_user(self, username: str, permanent: bool = False) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            if permanent:
                cursor.execute("DELETE FROM tracked_users WHERE username = %s", (username,))
            else:
                cursor.execute("UPDATE tracked_users SET is_active = false WHERE username = %s", (username,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_inactive_users(self, days: int = 30) -> List[str]:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT username FROM tracked_users
                WHERE is_active = true
                AND (last_scraped IS NULL OR last_scraped < NOW() - INTERVAL '%s days')
            """, (days,))
            return [row['username'] for row in cursor.fetchall()]
        finally:
            conn.close()

    def find_popular_users(self, min_like_count: int = 100, limit: int = 20) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT username, AVG(like_count) as avg_likes, AVG(reply_count) as avg_replies, COUNT(*) as post_count
                FROM posts
                GROUP BY username
                HAVING AVG(like_count) >= %s
                ORDER BY avg_likes DESC
                LIMIT %s
            """, (min_like_count, limit))
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()
