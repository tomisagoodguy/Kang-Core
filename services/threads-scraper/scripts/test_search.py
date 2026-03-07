"""
快速測試搜尋功能 - 搜尋 2-3 個關鍵字演示
"""

from src.core.scraper import scrape_search
from collections import defaultdict

def quick_test():
    """快速測試：搜尋 2 個關鍵字"""

    # 測試關鍵字
    test_keywords = ["AI", "程式設計"]

    print("=" * 60)
    print("🧪 快速測試：自動搜尋功能")
    print("=" * 60)
    print(f"測試關鍵字: {', '.join(test_keywords)}")
    print()

    user_stats = defaultdict(lambda: {
        "post_count": 0,
        "total_likes": 0,
        "keywords": set()
    })

    for keyword in test_keywords:
        print(f"🔍 搜尋: {keyword}")

        try:
            result = scrape_search(keyword, headless=True, max_scrolls=2)
            posts = result.get("posts", [])

            print(f"   找到 {len(posts)} 篇貼文")

            # 統計用戶
            for post in posts:
                username = post.get("username")
                if username:
                    user_stats[username]["post_count"] += 1
                    user_stats[username]["total_likes"] += post.get("like_count", 0)
                    user_stats[username]["keywords"].add(keyword)

            print(f"   ✅ 完成\n")

        except Exception as e:
            print(f"   ❌ 錯誤: {e}\n")

    # 顯示結果
    print("=" * 60)
    print("📊 測試結果")
    print("=" * 60)

    if not user_stats:
        print("未找到任何用戶")
        return

    # 排序：按貼文數
    sorted_users = sorted(
        user_stats.items(),
        key=lambda x: x[1]["post_count"],
        reverse=True
    )

    print(f"發現 {len(sorted_users)} 個用戶\n")
    print("最活躍的前 10 名:")

    for i, (username, stats) in enumerate(sorted_users[:10], 1):
        avg_likes = stats["total_likes"] / stats["post_count"] if stats["post_count"] > 0 else 0
        keywords = ", ".join(stats["keywords"])

        print(f"{i:2d}. @{username}")
        print(f"    發文數: {stats['post_count']}")
        print(f"    平均讚數: {avg_likes:.1f}")
        print(f"    配對關鍵字: {keywords}")
        print()

    print("=" * 60)
    print("✅ 測試完成！")
    print()
    print("💡 完整功能請執行:")
    print("   uv run python scripts/auto_find_users.py")
    print("=" * 60)

if __name__ == "__main__":
    quick_test()
