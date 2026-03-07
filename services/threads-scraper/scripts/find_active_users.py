"""
在 Threads 上搜尋關鍵字，找出活躍的繁體中文科技用戶
"""

import time
from collections import Counter
from typing import List, Dict
from src.core.scraper import ThreadsScraper
from src.core.config_loader import load_config


def search_and_find_users(keywords: List[str], posts_per_keyword: int = 20) -> Dict:
    """
    透過關鍵字搜尋，找出最活躍的發文者

    Args:
        keywords: 搜尋關鍵字列表
        posts_per_keyword: 每個關鍵字抓取的貼文數

    Returns:
        用戶統計資料
    """
    config = load_config("config/config.yaml")
    scraper = ThreadsScraper(config)

    user_stats = {}  # {username: {post_count, total_likes, total_replies, posts: []}}

    print("🔍 開始搜尋關鍵字並統計活躍用戶...\n")

    for keyword in keywords:
        print(f"📌 搜尋關鍵字: {keyword}")

        try:
            # 使用 scraper 的搜尋功能
            # 注意：這個功能需要在 scraper.py 中實作
            # 暫時用探索模式來模擬搜尋

            # 方法：開啟 Threads 搜尋頁面
            search_url = f"https://www.threads.net/search?q={keyword}&serp_type=default"

            # 這裡需要實際的搜尋實作
            # 暫時先顯示訊息
            print(f"   提示：請手動在 Threads 搜尋 '{keyword}'")
            print(f"   然後記錄活躍的用戶名稱\n")

        except Exception as e:
            print(f"   ❌ 錯誤: {e}")

        time.sleep(3)  # 避免限流

    scraper.close()

    # 排序並顯示結果
    if user_stats:
        print("\n" + "="*60)
        print("📊 活躍用戶統計")
        print("="*60)

        sorted_users = sorted(
            user_stats.items(),
            key=lambda x: x[1]["post_count"],
            reverse=True
        )

        for i, (username, stats) in enumerate(sorted_users[:20], 1):
            avg_likes = stats["total_likes"] / stats["post_count"]
            print(f"{i:2d}. @{username}")
            print(f"    發文數: {stats['post_count']}")
            print(f"    平均讚數: {avg_likes:.1f}")
            print(f"    總互動: {stats['total_replies']}")
            print()

    return user_stats


def manual_search_guide():
    """
    手動搜尋指南
    """
    keywords = [
        "AI", "人工智慧", "ChatGPT", "Claude",
        "程式設計", "軟體開發", "編程",
        "React", "Python", "JavaScript",
        "新創", "創業", "產品",
        "科技", "技術"
    ]

    print("="*60)
    print("🔍 Threads 手動搜尋指南")
    print("="*60)
    print("\n在 Threads 上活躍的繁體中文科技用戶搜尋方法：\n")

    print("📱 步驟：")
    print("1. 開啟 Threads App 或網頁版 (threads.net)")
    print("2. 點擊搜尋圖示 🔍")
    print("3. 輸入以下關鍵字，逐一搜尋：\n")

    for i, keyword in enumerate(keywords, 1):
        print(f"   {i:2d}. {keyword}")

    print("\n4. 觀察搜尋結果：")
    print("   - 哪些用戶經常出現？")
    print("   - 哪些貼文互動數高？")
    print("   - 內容是否為繁體中文？")
    print("   - 是否專注於科技/AI 主題？")

    print("\n5. 記錄活躍用戶：")
    print("   - 點進用戶頁面")
    print("   - 確認發文頻率（每週 > 3 篇）")
    print("   - 確認內容質量")
    print("   - 記下用戶名 (@username)")

    print("\n💡 技巧：")
    print("   - 優先追蹤有認證徽章的帳號")
    print("   - 看誰經常回覆熱門貼文")
    print("   - 注意貼文的發布時間（最近 7 天內）")

    print("\n" + "="*60)
    print("✅ 找到用戶後，加入 config/config.yaml：")
    print("="*60)
    print("""
users:
  - username: "找到的用戶名"
    max_posts: 10
""")


def suggest_tracking_method():
    """
    建議追蹤方法
    """
    print("\n" + "="*60)
    print("🎯 推薦的追蹤策略")
    print("="*60)

    print("\n【策略 1】從互動中發現（自動化）")
    print("   ✅ 使用你現有的 discovery.py")
    print("   ✅ 從 @fox.hsiao 的貼文回覆中找活躍用戶")
    print("   ✅ 系統會自動追蹤高互動用戶")

    print("\n【策略 2】手動搜尋（最準確）")
    print("   ✅ 在 Threads 搜尋關鍵字")
    print("   ✅ 記錄經常出現的用戶")
    print("   ✅ 手動加入 config.yaml")

    print("\n【策略 3】從 Instagram 對照")
    print("   ✅ 找 IG 上的台灣科技 KOL")
    print("   ✅ 看他們是否有 Threads 帳號")
    print("   ✅ Threads 用戶名通常與 IG 相同")

    print("\n【策略 4】觀察 Threads 推薦")
    print("   ✅ 瀏覽 Threads 首頁")
    print("   ✅ 看「為你推薦」區塊")
    print("   ✅ 記錄繁體中文科技內容")


def main():
    """主程式"""
    manual_search_guide()
    suggest_tracking_method()

    print("\n" + "="*60)
    print("💡 下一步")
    print("="*60)
    print("1. 手動在 Threads 搜尋關鍵字")
    print("2. 記錄 5-10 個活躍的繁體中文科技用戶")
    print("3. 加入 config/config.yaml")
    print("4. 執行 'uv run python run_scheduler.py run' 測試")
    print("5. 讓系統自動發現更多相關用戶")
    print("="*60)


if __name__ == "__main__":
    main()
