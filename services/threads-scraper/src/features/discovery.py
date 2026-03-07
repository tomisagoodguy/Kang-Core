"""
用戶發現模組 - 從熱門貼文中自動發現優質發文者
"""

from typing import Dict, List
from src.core.database import ThreadsDatabase


class UserDiscovery:
    def __init__(self, db: ThreadsDatabase, config: Dict):
        """
        初始化用戶發現器

        Args:
            db: 資料庫實例
            config: 發現設定
        """
        self.db = db
        self.config = config

        # 發現條件
        self.min_like_count = config.get("min_like_count", 100)
        self.min_reply_count = config.get("min_reply_count", 10)
        self.min_posts = config.get("min_posts", 3)
        self.max_new_users = config.get("max_new_users_per_run", 10)
        self.auto_track = config.get("auto_track", True)

    def discover_from_database(self) -> List[str]:
        """
        從已抓取的貼文中發現熱門用戶

        Returns:
            新發現的用戶名稱列表
        """
        print("\n🔍 正在從資料庫中發現熱門用戶...")

        # 取得熱門用戶
        popular_users = self.db.find_popular_users(
            min_like_count=self.min_like_count,
            limit=50  # 先找出較多候選人
        )

        if not popular_users:
            print("   ℹ️  未發現符合條件的用戶")
            return []

        # 取得已追蹤的用戶
        tracked = self.db.get_tracked_users(active_only=False)
        tracked_usernames = {u["username"] for u in tracked}

        # 篩選新用戶
        new_users = []
        for user in popular_users:
            username = user["username"]
            avg_likes = user["avg_likes"]
            avg_replies = user.get("avg_replies") or 0
            post_count = user["post_count"]

            # 檢查是否已追蹤
            if username in tracked_usernames:
                continue

            # 檢查是否符合條件
            if post_count < self.min_posts:
                continue
            if avg_replies < self.min_reply_count:
                continue

            new_users.append({
                "username": username,
                "avg_likes": avg_likes,
                "avg_replies": avg_replies,
                "post_count": post_count
            })

            # 限制數量
            if len(new_users) >= self.max_new_users:
                break

        if new_users:
            print(f"   ✅ 發現 {len(new_users)} 個符合條件的新用戶:")
            for user in new_users:
                print(f"      @{user['username']} - "
                      f"平均 {user['avg_likes']:.0f} 讚，"
                      f"{user['avg_replies']:.0f} 回覆，"
                      f"共 {user['post_count']} 篇")

            # 自動加入追蹤
            if self.auto_track:
                for user in new_users:
                    notes = (f"自動發現 - 平均 {user['avg_likes']:.0f} 讚，"
                            f"{user['avg_replies']:.0f} 回覆")
                    self.db.add_tracked_user(
                        username=user["username"],
                        discovered_from="auto_discovery",
                        notes=notes
                    )

            return [u["username"] for u in new_users]
        else:
            print("   ℹ️  未發現新的優質用戶")
            return []

    def discover_from_post(self, post: Dict) -> bool:
        """
        從單篇熱門貼文中發現作者

        Args:
            post: 貼文資料

        Returns:
            是否成功加入追蹤
        """
        username = post.get("username")
        like_count = post.get("like_count", 0)
        reply_count = post.get("reply_count", 0)

        # 檢查是否符合熱門條件
        if like_count < self.min_like_count:
            return False

        # 檢查是否已追蹤
        tracked = self.db.get_tracked_users(active_only=False)
        tracked_usernames = {u["username"] for u in tracked}

        if username in tracked_usernames:
            return False

        # 加入追蹤
        if self.auto_track:
            notes = f"熱門貼文 - {like_count} 讚，{reply_count} 回覆"
            return self.db.add_tracked_user(
                username=username,
                discovered_from=post.get("id", "unknown"),
                notes=notes
            )

        return False

    def discover_from_replies(self, replies: List[Dict]) -> List[str]:
        """
        從回覆中發現活躍用戶

        Args:
            replies: 回覆列表

        Returns:
            新發現的用戶名稱列表
        """
        # 統計每個用戶的回覆數和平均按讚數
        user_stats = {}

        for reply in replies:
            username = reply.get("username")
            like_count = reply.get("like_count", 0)

            if username not in user_stats:
                user_stats[username] = {
                    "count": 0,
                    "total_likes": 0
                }

            user_stats[username]["count"] += 1
            user_stats[username]["total_likes"] += like_count

        # 取得已追蹤的用戶
        tracked = self.db.get_tracked_users(active_only=False)
        tracked_usernames = {u["username"] for u in tracked}

        # 找出活躍且高互動的用戶
        new_users = []
        for username, stats in user_stats.items():
            if username in tracked_usernames:
                continue

            reply_count = stats["count"]
            avg_likes = stats["total_likes"] / reply_count

            # 檢查條件（回覆中的條件可以放寬一些）
            if reply_count >= 2 and avg_likes >= self.min_like_count / 2:
                new_users.append(username)

                if self.auto_track:
                    notes = f"活躍回覆者 - {reply_count} 則回覆，平均 {avg_likes:.0f} 讚"
                    self.db.add_tracked_user(
                        username=username,
                        discovered_from="replies",
                        notes=notes
                    )

        return new_users

    def cleanup_inactive_users(self, days: int = 60):
        """
        清理長時間不活躍的追蹤用戶

        Args:
            days: 超過幾天未更新視為不活躍
        """
        print(f"\n🧹 清理 {days} 天內未更新的用戶...")

        inactive_users = self.db.get_inactive_users(days=days)

        if not inactive_users:
            print("   ℹ️  無需清理")
            return

        print(f"   找到 {len(inactive_users)} 個不活躍用戶")

        for username in inactive_users:
            self.db.remove_tracked_user(username, permanent=False)
            print(f"   ⏸️  已停止追蹤: @{username}")

    def get_discovery_report(self) -> Dict:
        """取得發現報告"""
        tracked_users = self.db.get_tracked_users(active_only=True)

        report = {
            "total_tracked": len(tracked_users),
            "auto_discovered": sum(1 for u in tracked_users
                                  if u["discovered_from"] != "manual"),
            "manual_added": sum(1 for u in tracked_users
                               if u["discovered_from"] == "manual"),
            "avg_engagement": 0,
            "top_performers": []
        }

        # 計算平均互動數
        if tracked_users:
            total_likes = sum(u.get("avg_like_count", 0) for u in tracked_users)
            report["avg_engagement"] = total_likes / len(tracked_users)

            # 找出表現最好的用戶
            sorted_users = sorted(
                tracked_users,
                key=lambda u: u.get("avg_like_count", 0),
                reverse=True
            )
            report["top_performers"] = sorted_users[:5]

        return report

    def print_report(self):
        """印出發現報告"""
        report = self.get_discovery_report()

        print("\n📊 用戶發現報告:")
        print(f"   總追蹤用戶數: {report['total_tracked']}")
        print(f"   自動發現: {report['auto_discovered']}")
        print(f"   手動新增: {report['manual_added']}")
        print(f"   平均互動數: {report['avg_engagement']:.1f} 讚")

        if report["top_performers"]:
            print(f"\n   🏆 表現最好的 5 位用戶:")
            for i, user in enumerate(report["top_performers"], 1):
                print(f"      {i}. @{user['username']} - "
                      f"平均 {user.get('avg_like_count', 0):.0f} 讚")
