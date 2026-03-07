"""
批次驗證 Threads 帳號是否存在
"""

import time
from typing import List, Dict
from src.core.scraper import ThreadsScraper
from src.core.config_loader import load_config


def verify_accounts(usernames: List[str]) -> List[Dict]:
    """
    驗證一批用戶名是否存在於 Threads

    Args:
        usernames: 用戶名列表

    Returns:
        驗證結果列表
    """
    config = load_config("config/config.yaml")
    scraper = ThreadsScraper(config)

    results = []

    print(f"\n🔍 開始驗證 {len(usernames)} 個帳號...\n")

    for i, username in enumerate(usernames, 1):
        print(f"[{i}/{len(usernames)}] 檢查 @{username}... ", end="", flush=True)

        try:
            user_data = scraper.scrape_user(username, max_posts=1)

            if user_data and user_data.get("posts"):
                post_count = len(user_data["posts"])
                print(f"✅ 存在 ({post_count} 篇貼文)")

                results.append({
                    "username": username,
                    "exists": True,
                    "post_count": post_count,
                    "status": "active"
                })
            else:
                print("⚠️  帳號存在但無貼文")
                results.append({
                    "username": username,
                    "exists": True,
                    "post_count": 0,
                    "status": "inactive"
                })

        except Exception as e:
            print(f"❌ 不存在或錯誤: {str(e)[:50]}")
            results.append({
                "username": username,
                "exists": False,
                "error": str(e),
                "status": "not_found"
            })

        # 避免被限流
        if i < len(usernames):
            time.sleep(3)

    scraper.close()

    return results


def print_summary(results: List[Dict]):
    """印出驗證摘要"""

    active = [r for r in results if r["status"] == "active"]
    inactive = [r for r in results if r["status"] == "inactive"]
    not_found = [r for r in results if r["status"] == "not_found"]

    print("\n" + "="*60)
    print("📊 驗證摘要")
    print("="*60)
    print(f"總計: {len(results)} 個帳號")
    print(f"✅ 活躍: {len(active)} 個")
    print(f"⚠️  無貼文: {len(inactive)} 個")
    print(f"❌ 不存在: {len(not_found)} 個")

    if active:
        print("\n✅ 建議追蹤（活躍帳號）:")
        for r in active:
            print(f"  - username: \"{r['username']}\"")
            print(f"    max_posts: 10")

    if not_found:
        print("\n❌ 以下帳號不存在或需要修正:")
        for r in not_found:
            print(f"  - {r['username']}")


def main():
    """主程式"""

    # 建議測試的帳號（來自 SUGGESTED_ACCOUNTS.md）
    test_accounts = [
        # AI / ML
        "sama",           # Sam Altman
        "emollick",       # Ethan Mollick
        "drjimfan",       # Jim Fan
        "hardmaru",       # David Ha

        # 繁體中文
        "bnextmedia",     # 數位時代
        "inside_tw",      # INSIDE

        # 科技媒體
        "techcrunch",     # TechCrunch
        "wired",          # WIRED
        "engadget",       # Engadget

        # 開發者
        "dan_abramov",    # Dan Abramov
        "kentcdodds",     # Kent C. Dodds
        "swyx",           # Shawn Wang
        "shadcn",         # shadcn
        "t3dotgg",        # Theo Browne
        "levelsio",       # Pieter Levels
        "dhh",            # DHH

        # 產品
        "lenny",          # Lenny Rachitsky
        "shreyas",        # Shreyas Doshi
        "joulee",         # Julie Zhuo

        # 平台
        "vercel",         # Vercel
        "github",         # GitHub
        "supabase",       # Supabase
        "railway",        # Railway
    ]

    print("=" * 60)
    print("🔍 Threads 帳號批次驗證工具")
    print("=" * 60)
    print(f"將測試 {len(test_accounts)} 個建議帳號")
    print("\n⚠️  注意：這個過程可能需要幾分鐘")
    print("按 Ctrl+C 可隨時中斷\n")

    input("按 Enter 開始驗證...")

    try:
        results = verify_accounts(test_accounts)
        print_summary(results)

        # 儲存結果
        import json
        with open("verified_accounts.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\n💾 完整結果已儲存到: verified_accounts.json")

    except KeyboardInterrupt:
        print("\n\n⚠️  驗證已中斷")
    except Exception as e:
        print(f"\n❌ 錯誤: {e}")


if __name__ == "__main__":
    main()
