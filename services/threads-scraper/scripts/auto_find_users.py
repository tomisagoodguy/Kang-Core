"""
自動搜尋 Threads 關鍵字，找出最活躍的繁體中文科技用戶
"""

import time
import re
from collections import defaultdict
from typing import List, Dict
from src.core.scraper import scrape_search
from src.core.config_loader import load_config


def is_traditional_chinese(text: str) -> bool:
    """
    簡單檢查文字是否包含繁體中文
    （簡易版本，實際使用可能需要更精確的判斷）
    """
    if not text:
        return False

    # 檢查是否包含中文字符
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)

    # 如果沒有中文字符，返回 False
    if not chinese_chars:
        return False

    # 常見簡體字（不完全，僅供參考）
    simplified_chars = set('国门进会学时间长经济来说话对实说还这')

    # 如果包含簡體字比例很高，可能是簡體中文
    simplified_count = sum(1 for char in text if char in simplified_chars)

    return simplified_count / len(chinese_chars) < 0.3 if chinese_chars else False


def search_keywords_and_analyze(
    keywords: List[str],
    posts_per_keyword: int = 20,
    headless: bool = True
) -> Dict:
    """
    搜尋多個關鍵字並分析活躍用戶

    Args:
        keywords: 關鍵字列表
        posts_per_keyword: 每個關鍵字抓取的貼文數（透過滾動次數控制）
        headless: 是否使用無頭模式

    Returns:
        用戶統計資料
    """
    user_stats = defaultdict(lambda: {
        "post_count": 0,
        "total_likes": 0,
        "total_replies": 0,
        "keywords_matched": set(),
        "posts": [],
        "is_traditional_chinese": False
    })

    print("=" * 60)
    print("🔍 開始自動搜尋 Threads 關鍵字")
    print("=" * 60)
    print(f"搜尋關鍵字數: {len(keywords)}")
    print(f"每個關鍵字滾動次數: {posts_per_keyword // 10 + 1}")
    print()

    for i, keyword in enumerate(keywords, 1):
        print(f"\n[{i}/{len(keywords)}] 搜尋關鍵字: {keyword}")
        print("-" * 40)

        try:
            # 計算滾動次數（每次約 10 篇）
            max_scrolls = max(1, posts_per_keyword // 10)

            result = scrape_search(keyword, headless=headless, max_scrolls=max_scrolls)
            posts = result.get("posts", [])

            print(f"   找到 {len(posts)} 篇貼文")

            # 統計每個用戶
            for post in posts:
                username = post.get("username")
                text = post.get("text", "")
                like_count = post.get("like_count") or 0
                reply_count = post.get("reply_count") or 0

                if not username:
                    continue

                # 累積統計
                user_stats[username]["post_count"] += 1
                user_stats[username]["total_likes"] += like_count
                user_stats[username]["total_replies"] += reply_count
                user_stats[username]["keywords_matched"].add(keyword)
                user_stats[username]["posts"].append({
                    "text": text[:100],  # 只保留前 100 字
                    "likes": like_count,
                    "replies": reply_count,
                    "keyword": keyword
                })

                # 檢查是否為繁體中文
                if is_traditional_chinese(text):
                    user_stats[username]["is_traditional_chinese"] = True

        except Exception as e:
            print(f"   ❌ 錯誤: {e}")

        # 避免被限流
        if i < len(keywords):
            print(f"   ⏳ 等待 5 秒...")
            time.sleep(5)

    return dict(user_stats)


def filter_and_rank_users(user_stats: Dict, min_posts: int = 2) -> List[tuple]:
    """
    過濾並排序用戶

    Args:
        user_stats: 用戶統計資料
        min_posts: 最少貼文數

    Returns:
        排序後的用戶列表 [(username, stats), ...]
    """
    # 過濾：至少有 min_posts 篇貼文
    filtered = {
        username: stats
        for username, stats in user_stats.items()
        if stats["post_count"] >= min_posts
    }

    # 排序：先按繁體中文，再按貼文數，最後按平均讚數
    sorted_users = sorted(
        filtered.items(),
        key=lambda x: (
            x[1]["is_traditional_chinese"],  # 繁體中文優先
            x[1]["post_count"],              # 貼文數多優先
            x[1]["total_likes"] / x[1]["post_count"]  # 平均讚數高優先
        ),
        reverse=True
    )

    return sorted_users


def print_results(sorted_users: List[tuple], top_n: int = 20):
    """印出結果"""
    print("\n" + "=" * 60)
    print("📊 活躍用戶分析結果")
    print("=" * 60)
    print(f"符合條件的用戶數: {len(sorted_users)}")
    print(f"顯示前 {min(top_n, len(sorted_users))} 名")
    print()

    for i, (username, stats) in enumerate(sorted_users[:top_n], 1):
        avg_likes = stats["total_likes"] / stats["post_count"]
        avg_replies = stats["total_replies"] / stats["post_count"]
        keywords = ", ".join(list(stats["keywords_matched"])[:5])

        lang_flag = "🇹🇼" if stats["is_traditional_chinese"] else "🌐"

        print(f"{i:2d}. {lang_flag} @{username}")
        print(f"    發文數: {stats['post_count']}")
        print(f"    平均讚數: {avg_likes:.1f}")
        print(f"    平均回覆: {avg_replies:.1f}")
        print(f"    配對關鍵字: {keywords}")
        print()


def generate_config_yaml(sorted_users: List[tuple], top_n: int = 10):
    """產生 config.yaml 格式的用戶列表"""
    print("=" * 60)
    print("✅ 建議加入 config.yaml 的用戶")
    print("=" * 60)
    print("\n# 自動發現的繁體中文科技用戶")
    print("users:")

    for username, stats in sorted_users[:top_n]:
        if stats["is_traditional_chinese"]:
            avg_likes = stats["total_likes"] / stats["post_count"]
            print(f"  - username: \"{username}\"")
            print(f"    max_posts: 10")
            print(f"    # 平均 {avg_likes:.0f} 讚，{stats['post_count']} 篇貼文")


def main():
    """主程式"""
    # AI 相關關鍵字（增強版，包含專有詞語）
    keywords = [
        # 基礎 AI
        "AI", "人工智慧", "ChatGPT", "Claude", "GPT", "LLM", "Gemini",

        # AI 技術
        "機器學習", "深度學習", "神經網路", "Transformer",
        "大語言模型", "RAG", "Prompt Engineering",
        "向量資料庫", "Embedding",

        # AI Agent
        "AI agent", "智能代理", "自動化", "LangChain",

        # AI 應用
        "Midjourney", "Stable Diffusion", "DALL-E",
        "AI繪圖", "AI寫作", "Copilot",

        # AI 公司
        "OpenAI", "Anthropic", "Meta AI", "DeepSeek",

        # 開發相關
        "程式設計", "軟體開發", "編程",
        "Python", "JavaScript", "React",
        "API", "GitHub", "開源",

        # 產品與創業
        "產品", "SaaS", "新創", "創業",
    ]

    print("將搜尋以下關鍵字:")
    for kw in keywords:
        print(f"  - {kw}")
    print()
    print("⚠️  這個過程需要 20-30 分鐘")
    print("🚀 開始自動搜尋...\n")

    # 執行搜尋和分析
    user_stats = search_keywords_and_analyze(
        keywords=keywords,
        posts_per_keyword=20,  # 每個關鍵字約 20 篇
        headless=True  # 背景執行
    )

    # 過濾和排序
    sorted_users = filter_and_rank_users(user_stats, min_posts=2)

    # 顯示結果
    print_results(sorted_users, top_n=30)

    # 產生 config.yaml 格式
    generate_config_yaml(sorted_users, top_n=15)

    # 儲存完整結果
    import json
    output_file = "discovered_users.json"
    with open(output_file, "w", encoding="utf-8") as f:
        # 轉換 set 為 list 以便序列化
        for username, stats in user_stats.items():
            stats["keywords_matched"] = list(stats["keywords_matched"])
        json.dump(user_stats, f, ensure_ascii=False, indent=2)

    print(f"\n💾 完整結果已儲存到: {output_file}")


if __name__ == "__main__":
    main()
