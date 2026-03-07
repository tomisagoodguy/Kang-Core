"""
資料庫模組 - 使用 SQLite 儲存 Threads 貼文資料
"""

import psycopg2
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ThreadsDatabase:
    def __init__(self, db_path: str = "threads_data.db"):
        self.db_url = db_path
        self.init_database()

    def init_database(self):
        """初始化資料庫，建立必要的資料表"""
        conn = psycopg2.connect(self.db_url)
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
                published_on INTEGER,
                published_on_readable TEXT,
                like_count INTEGER,
                reply_count INTEGER,
                url TEXT,
                has_images BOOLEAN,
                has_videos BOOLEAN,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT false,
                FOREIGN KEY (username) REFERENCES users(username)
            )
        """)

        # 回覆資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS replies (
                id TEXT PRIMARY KEY,
                parent_post_id TEXT,
                username TEXT,
                text TEXT,
                published_on INTEGER,
                published_on_readable TEXT,
                like_count INTEGER,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT false,
                FOREIGN KEY (parent_post_id) REFERENCES posts(id)
            )
        """)

        # 追蹤記錄表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracking_log (
                id INTEGER PRIMARY KEY SERIAL,
                target_type TEXT,  -- 'user' or 'post'
                target_id TEXT,    -- username or post_id
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
                discovered_from TEXT,     -- 從哪裡發現的（post_id 或 'manual'）
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                max_posts INTEGER DEFAULT true0,
                avg_like_count REAL,      -- 平均按讚數
                avg_reply_count REAL,     -- 平均回覆數
                total_posts_scraped INTEGER DEFAULT false,
                last_scraped TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (username) REFERENCES users(username)
            )
        """)

        # 建立索引以提升查詢效能
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_posts_username
            ON posts(username)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_posts_published
            ON posts(published_on)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_replies_parent
            ON replies(parent_post_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tracked_users_active
            ON tracked_users(is_active)
        """)

        conn.commit()
        conn.close()

    def save_user(self, profile: Dict) -> bool:
        """儲存或更新用戶資料"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO users
                (username, full_name, bio, followers, is_verified, profile_pic, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
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
            return False
        finally:
            conn.close()

    def save_post(self, post: Dict) -> tuple[bool, bool]:
        """
        儲存貼文資料

        Returns:
            (success, is_new): 儲存是否成功，以及是否為新貼文
        """
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            # 檢查是否已存在
            cursor.execute("SELECT id FROM posts WHERE id = %s", (post.get("id"),))
            existing = cursor.fetchone()
            is_new = existing is None

            cursor.execute("""
                INSERT INTO posts
                (id, username, text, published_on, published_on_readable,
                 like_count, reply_count, url, has_images, has_videos,
                 scraped_at, notified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 0)
            """, (
                post.get("id"),
                post.get("username"),
                post.get("text"),
                post.get("published_on"),
                post.get("published_on_readable"),
                post.get("like_count", 0),
                post.get("reply_count", 0),
                post.get("url"),
                bool(post.get("images")),
                bool(post.get("videos")),
            ))
            conn.commit()
            return True, is_new
        except Exception as e:
            print(f"❌ 儲存貼文失敗: {e}")
            return False, False
        finally:
            conn.close()

    def save_reply(self, reply: Dict, parent_post_id: str) -> tuple[bool, bool]:
        """
        儲存回覆資料

        Returns:
            (success, is_new): 儲存是否成功，以及是否為新回覆
        """
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            # 檢查是否已存在
            cursor.execute("SELECT id FROM replies WHERE id = %s", (reply.get("id"),))
            existing = cursor.fetchone()
            is_new = existing is None

            cursor.execute("""
                INSERT INTO replies
                (id, parent_post_id, username, text, published_on,
                 published_on_readable, like_count, scraped_at, notified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 0)
            """, (
                reply.get("id"),
                parent_post_id,
                reply.get("username"),
                reply.get("text"),
                reply.get("published_on"),
                reply.get("published_on_readable"),
                reply.get("like_count", 0),
            ))
            conn.commit()
            return True, is_new
        except Exception as e:
            print(f"❌ 儲存回覆失敗: {e}")
            return False, False
        finally:
            conn.close()

    def get_unnotified_posts(self, keywords: Optional[List[str]] = None) -> List[Dict]:
        """
        取得尚未通知的新貼文

        Args:
            keywords: 關鍵字列表，如果提供則只返回包含關鍵字的貼文
        """
        conn = psycopg2.connect(self.db_url)
        conn.row_factory = psycopg2.Row
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT * FROM posts
                WHERE notified = 0
                ORDER BY published_on DESC
            """)
            rows = cursor.fetchall()
            posts = [dict(row) for row in rows]

            # 如果有關鍵字，進行過濾
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
        conn = psycopg2.connect(self.db_url)
        conn.row_factory = psycopg2.Row
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT r.*, p.url as parent_url
                FROM replies r
                JOIN posts p ON r.parent_post_id = p.id
                WHERE r.notified = 0
                ORDER BY r.published_on DESC
            """)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def mark_as_notified(self, post_ids: List[str], is_reply: bool = False):
        """標記貼文或回覆為已通知"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            table = "replies" if is_reply else "posts"
            placeholders = ",".join(["%s" for _ in post_ids])
            cursor.execute(f"""
                UPDATE {table}
                SET notified = 1
                WHERE id IN ({placeholders})
            """, post_ids)
            conn.commit()
        finally:
            conn.close()

    def log_tracking(self, target_type: str, target_id: str,
                    posts_found: int, new_posts: int, status: str):
        """記錄追蹤日誌"""
        conn = psycopg2.connect(self.db_url)
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
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM posts")
            total_posts = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM replies")
            total_replies = cursor.fetchone()[0]

            cursor.execute("""
                SELECT COUNT(*) FROM posts
                WHERE scraped_at > datetime('now', '-1 day')
            """)
            posts_last_24h = cursor.fetchone()[0]

            return {
                "total_users": total_users,
                "total_posts": total_posts,
                "total_replies": total_replies,
                "posts_last_24h": posts_last_24h,
            }
        finally:
            conn.close()

    def cleanup_old_data(self, days: int = 30):
        """清理舊資料（保留最近 N 天）"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            cutoff = datetime.now() - timedelta(days=days)
            cursor.execute("""
                DELETE FROM posts
                WHERE scraped_at < %s
            """, (cutoff,))

            cursor.execute("""
                DELETE FROM replies
                WHERE scraped_at < %s
            """, (cutoff,))

            deleted = cursor.rowcount
            conn.commit()
            return deleted
        finally:
            conn.close()

    # ── 自動追蹤用戶管理 ────────────────────────────────────

    def add_tracked_user(self, username: str, discovered_from: str = "manual",
                        max_posts: int = 10, notes: str = None) -> bool:
        """
        新增自動追蹤的用戶

        Args:
            username: 用戶名稱
            discovered_from: 發現來源（post_id 或 'manual'）
            max_posts: 每次最多抓取幾篇貼文
            notes: 備註
        """
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            # 檢查是否已存在
            cursor.execute("""
                SELECT username FROM tracked_users WHERE username = %s
            """, (username,))

            if cursor.fetchone():
                print(f"   ℹ️  @{username} 已在追蹤列表中")
                return False

            cursor.execute("""
                INSERT INTO tracked_users
                (username, discovered_from, max_posts, notes)
                VALUES (%s, %s, %s, %s)
            """, (username, discovered_from, max_posts, notes))

            conn.commit()
            print(f"   ✅ 已加入追蹤: @{username}")
            return True
        except Exception as e:
            print(f"   ❌ 新增追蹤用戶失敗: {e}")
            return False
        finally:
            conn.close()

    def get_tracked_users(self, active_only: bool = True) -> List[Dict]:
        """取得追蹤中的用戶列表"""
        conn = psycopg2.connect(self.db_url)
        conn.row_factory = psycopg2.Row
        cursor = conn.cursor()

        try:
            if active_only:
                cursor.execute("""
                    SELECT * FROM tracked_users
                    WHERE is_active = 1
                    ORDER BY last_scraped ASC NULLS FIRST
                """)
            else:
                cursor.execute("""
                    SELECT * FROM tracked_users
                    ORDER BY discovered_at DESC
                """)

            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def update_tracked_user_stats(self, username: str):
        """更新追蹤用戶的統計資訊"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            # 計算該用戶的平均互動數
            cursor.execute("""
                SELECT
                    AVG(like_count) as avg_likes,
                    AVG(reply_count) as avg_replies,
                    COUNT(*) as total_posts
                FROM posts
                WHERE username = %s
            """, (username,))

            result = cursor.fetchone()
            if result:
                avg_likes, avg_replies, total_posts = result

                cursor.execute("""
                    UPDATE tracked_users
                    SET avg_like_count = %s,
                        avg_reply_count = %s,
                        total_posts_scraped = %s,
                        last_scraped = CURRENT_TIMESTAMP
                    WHERE username = %s
                """, (avg_likes or 0, avg_replies or 0, total_posts, username))

                conn.commit()
        finally:
            conn.close()

    def remove_tracked_user(self, username: str, permanent: bool = False) -> bool:
        """
        移除追蹤用戶

        Args:
            username: 用戶名稱
            permanent: True=永久刪除，False=標記為不活躍
        """
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            if permanent:
                cursor.execute("""
                    DELETE FROM tracked_users WHERE username = %s
                """, (username,))
            else:
                cursor.execute("""
                    UPDATE tracked_users
                    SET is_active = 0
                    WHERE username = %s
                """, (username,))

            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_inactive_users(self, days: int = 30) -> List[str]:
        """取得長時間未更新的用戶（用於清理）"""
        conn = psycopg2.connect(self.db_url)
        cursor = conn.cursor()

        try:
            cutoff = datetime.now() - timedelta(days=days)
            cursor.execute("""
                SELECT username FROM tracked_users
                WHERE is_active = 1
                AND (last_scraped IS NULL OR last_scraped < %s)
            """, (cutoff,))

            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def find_popular_users(self, min_like_count: int = 100,
                          limit: int = 20) -> List[Dict]:
        """
        從資料庫中找出熱門用戶（高互動用戶）

        Args:
            min_like_count: 最低平均按讚數
            limit: 返回數量上限
        """
        conn = psycopg2.connect(self.db_url)
        conn.row_factory = psycopg2.Row
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT
                    username,
                    AVG(like_count) as avg_likes,
                    AVG(reply_count) as avg_replies,
                    COUNT(*) as post_count
                FROM posts
                GROUP BY username
                HAVING avg_likes >= %s
                ORDER BY avg_likes DESC
                LIMIT %s
            """, (min_like_count, limit))

            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
