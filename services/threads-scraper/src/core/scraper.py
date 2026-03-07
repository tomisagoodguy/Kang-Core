"""
Threads Scraper - 使用 Playwright 抓取 Meta Threads 公開貼文
不需要登入，透過解析頁面中隱藏的 JSON 資料來取得貼文內容

使用方式：
    # 抓取單篇貼文
    python threads_scraper.py post https://www.threads.net/t/XXXXX

    # 抓取某個用戶的所有公開貼文
    python threads_scraper.py profile https://www.threads.net/@username

安裝依賴：
    pip install playwright nested-lookup jmespath parsel
    playwright install chromium
"""

import json
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional

import jmespath
from parsel import Selector
from nested_lookup import nested_lookup
from playwright.sync_api import sync_playwright


# ── 資料解析 ──────────────────────────────────────────────


def parse_thread(data: Dict) -> Dict:
    """從 Threads 的 JSON 資料中解析出重要欄位"""
    result = jmespath.search(
        """{
        text: post.caption.text,
        published_on: post.taken_at,
        id: post.id,
        pk: post.pk,
        code: post.code,
        username: post.user.username,
        user_pic: post.user.profile_pic_url,
        user_verified: post.user.is_verified,
        user_pk: post.user.pk,
        user_id: post.user.id,
        has_audio: post.has_audio,
        reply_count: view_replies_cta_string,
        like_count: post.like_count,
        images: post.carousel_media[].image_versions2.candidates[1].url,
        image_count: post.carousel_media_count,
        videos: post.video_versions[].url
    }""",
        data,
    )
    result["videos"] = list(set(result["videos"] or []))
    if result["reply_count"] and not isinstance(result["reply_count"], int):
        try:
            result["reply_count"] = int(result["reply_count"].split(" ")[0])
        except (ValueError, IndexError):
            result["reply_count"] = 0

    # 轉換 timestamp 為可讀時間
    if result.get("published_on"):
        result["published_on_readable"] = datetime.fromtimestamp(
            result["published_on"]
        ).strftime("%Y-%m-%d %H:%M:%S")

    result["url"] = (
        f"https://www.threads.net/@{result['username']}/post/{result['code']}"
    )
    return result


def parse_profile(data: Dict) -> Dict:
    """從 JSON 資料中解析用戶個人資料"""
    result = jmespath.search(
        """{
        is_private: is_private,
        is_verified: is_verified,
        profile_pic: hd_profile_pic_versions[-1].url,
        username: username,
        full_name: full_name,
        bio: biography,
        bio_links: bio_links[].url,
        followers: follower_count
    }""",
        data,
    )
    return result


# ── 爬取功能 ──────────────────────────────────────────────


def scrape_thread(url: str, headless: bool = True) -> dict:
    """
    抓取單篇 Threads 貼文及其回覆

    Args:
        url: Threads 貼文的 URL，例如 https://www.threads.net/t/XXXXX
        headless: 是否使用無頭模式（不顯示瀏覽器視窗）

    Returns:
        包含貼文內容和回覆的字典
    """
    print(f"🔍 正在抓取貼文: {url}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.wait_for_selector(
                "[data-pressable-container=true]", timeout=15000
            )
        except Exception as e:
            print(f"⚠️  頁面載入超時，嘗試繼續解析... ({e})")

        selector = Selector(page.content())
        hidden_datasets = selector.css(
            'script[type="application/json"][data-sjs]::text'
        ).getall()

        for hidden_dataset in hidden_datasets:
            if '"ScheduledServerJS"' not in hidden_dataset:
                continue
            if "thread_items" not in hidden_dataset:
                continue

            data = json.loads(hidden_dataset)
            thread_items = nested_lookup("thread_items", data)
            if not thread_items:
                continue

            threads = [
                parse_thread(t) for thread in thread_items for t in thread
            ]

            browser.close()
            print(f"✅ 成功抓取貼文，共 {len(threads) - 1} 則回覆")
            return {
                "thread": threads[0],
                "replies": threads[1:],
            }

        browser.close()
        raise ValueError("❌ 找不到貼文資料，頁面結構可能已變更")


def scrape_explore(headless: bool = True, max_scrolls: int = 3) -> dict:
    """
    抓取 Threads 探索頁面（熱門/推薦貼文）

    Args:
        headless: 是否使用無頭模式
        max_scrolls: 最多向下滾動幾次（每次約 10-15 篇貼文）

    Returns:
        包含探索貼文列表的字典
    """
    print(f"🔍 正在抓取探索頁面（滾動 {max_scrolls} 次）...")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            # 前往探索頁面（Threads 首頁）
            page.goto("https://www.threads.net/", wait_until="networkidle", timeout=30000)
            page.wait_for_selector(
                "[data-pressable-container=true]", timeout=15000
            )

            # 向下滾動以載入更多貼文
            for i in range(max_scrolls):
                print(f"   📜 滾動第 {i + 1}/{max_scrolls} 次...")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(2)  # 等待載入

        except Exception as e:
            print(f"⚠️  頁面載入超時，嘗試繼續解析... ({e})")

        selector = Selector(page.content())
        hidden_datasets = selector.css(
            'script[type="application/json"][data-sjs]::text'
        ).getall()

        threads_list = []
        seen_ids = set()

        for hidden_dataset in hidden_datasets:
            if '"ScheduledServerJS"' not in hidden_dataset:
                continue

            if "thread_items" not in hidden_dataset:
                continue

            data = json.loads(hidden_dataset)

            # 嘗試解析貼文
            thread_items = nested_lookup("thread_items", data)
            for thread in thread_items:
                for t in thread:
                    try:
                        parsed = parse_thread(t)
                        if parsed.get("text") and parsed.get("id") not in seen_ids:
                            threads_list.append(parsed)
                            seen_ids.add(parsed.get("id"))
                    except Exception:
                        continue

        browser.close()

        if not threads_list:
            raise ValueError("❌ 找不到探索貼文，頁面結構可能已變更")

        print(f"✅ 成功抓取探索頁面，共 {len(threads_list)} 篇貼文")
        return {
            "explore_posts": threads_list,
            "total": len(threads_list)
        }


def scrape_search(keyword: str, headless: bool = True, max_scrolls: int = 3) -> dict:
    """
    搜尋 Threads 關鍵字並抓取搜尋結果

    Args:
        keyword: 搜尋關鍵字
        headless: 是否使用無頭模式
        max_scrolls: 最多向下滾動幾次（每次約 10-15 篇貼文）

    Returns:
        包含搜尋結果貼文列表的字典
    """
    import urllib.parse

    encoded_keyword = urllib.parse.quote(keyword)
    search_url = f"https://www.threads.net/search?q={encoded_keyword}&serp_type=default"

    print(f"🔍 正在搜尋關鍵字: {keyword}")
    print(f"   URL: {search_url}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            # 前往搜尋頁面
            page.goto(search_url, wait_until="networkidle", timeout=30000)
            page.wait_for_selector(
                "[data-pressable-container=true]", timeout=15000
            )

            # 向下滾動以載入更多搜尋結果
            for i in range(max_scrolls):
                print(f"   📜 滾動第 {i + 1}/{max_scrolls} 次...")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(2)  # 等待載入

        except Exception as e:
            print(f"⚠️  頁面載入超時，嘗試繼續解析... ({e})")

        selector = Selector(page.content())
        hidden_datasets = selector.css(
            'script[type="application/json"][data-sjs]::text'
        ).getall()

        threads_list = []
        seen_ids = set()

        for hidden_dataset in hidden_datasets:
            if '"ScheduledServerJS"' not in hidden_dataset:
                continue

            if "thread_items" not in hidden_dataset:
                continue

            data = json.loads(hidden_dataset)

            # 嘗試解析貼文
            thread_items = nested_lookup("thread_items", data)
            for thread in thread_items:
                for t in thread:
                    try:
                        parsed = parse_thread(t)
                        if parsed.get("text") and parsed.get("id") not in seen_ids:
                            threads_list.append(parsed)
                            seen_ids.add(parsed.get("id"))
                    except Exception:
                        continue

        browser.close()

        if not threads_list:
            print(f"⚠️  未找到關鍵字 '{keyword}' 的搜尋結果")
            return {
                "keyword": keyword,
                "posts": [],
                "total": 0
            }

        print(f"✅ 成功搜尋關鍵字 '{keyword}'，共 {len(threads_list)} 篇貼文")
        return {
            "keyword": keyword,
            "posts": threads_list,
            "total": len(threads_list)
        }


def scrape_profile(url: str, headless: bool = True) -> dict:
    """
    抓取 Threads 用戶的個人資料和貼文

    Args:
        url: 用戶的 Threads 主頁 URL，例如 https://www.threads.net/@username
        headless: 是否使用無頭模式

    Returns:
        包含用戶資料和貼文列表的字典
    """
    print(f"🔍 正在抓取用戶頁面: {url}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.wait_for_selector(
                "[data-pressable-container=true]", timeout=15000
            )
        except Exception as e:
            print(f"⚠️  頁面載入超時，嘗試繼續解析... ({e})")

        selector = Selector(page.content())
        hidden_datasets = selector.css(
            'script[type="application/json"][data-sjs]::text'
        ).getall()

        profile_data = None
        threads_list = []

        for hidden_dataset in hidden_datasets:
            if '"ScheduledServerJS"' not in hidden_dataset:
                continue

            data = json.loads(hidden_dataset)

            # 嘗試解析用戶資料
            if not profile_data:
                users = nested_lookup("user", data)
                for user in users:
                    if isinstance(user, dict) and "biography" in user:
                        profile_data = parse_profile(user)
                        break

            # 嘗試解析貼文
            if "thread_items" in hidden_dataset:
                thread_items = nested_lookup("thread_items", data)
                for thread in thread_items:
                    for t in thread:
                        try:
                            parsed = parse_thread(t)
                            if parsed.get("text"):
                                threads_list.append(parsed)
                        except Exception:
                            continue

        browser.close()

        if not profile_data and not threads_list:
            raise ValueError("❌ 找不到用戶資料，頁面結構可能已變更")

        # 去除重複貼文
        seen_ids = set()
        unique_threads = []
        for t in threads_list:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                unique_threads.append(t)

        print(
            f"✅ 成功抓取用戶資料，共 {len(unique_threads)} 篇貼文"
        )
        return {
            "profile": profile_data,
            "threads": unique_threads,
        }


# ── 輸出工具 ──────────────────────────────────────────────


def save_json(data: dict, filename: str):
    """儲存結果為 JSON 檔案"""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 已儲存至 {filename}")


def print_thread_summary(data: dict):
    """在終端機印出貼文摘要"""
    thread = data.get("thread", {})
    replies = data.get("replies", [])

    print("\n" + "=" * 60)
    print(f"👤 @{thread.get('username', 'N/A')}")
    print(f"📝 {thread.get('text', 'N/A')}")
    print(f"🕐 {thread.get('published_on_readable', 'N/A')}")
    print(f"❤️  {thread.get('like_count', 0)} 讚")
    print(f"💬 {thread.get('reply_count', 0)} 則回覆")
    print(f"🔗 {thread.get('url', 'N/A')}")

    if replies:
        print(f"\n── 回覆 ({len(replies)}) ──")
        for i, reply in enumerate(replies[:5], 1):
            print(f"\n  [{i}] @{reply.get('username', 'N/A')}")
            text = reply.get("text", "")
            print(f"      {text[:80]}{'...' if len(text or '') > 80 else ''}")
        if len(replies) > 5:
            print(f"\n  ... 還有 {len(replies) - 5} 則回覆")
    print("=" * 60)


def print_profile_summary(data: dict):
    """在終端機印出用戶摘要"""
    profile = data.get("profile", {})
    threads = data.get("threads", [])

    print("\n" + "=" * 60)
    print(f"👤 @{profile.get('username', 'N/A')}")
    print(f"📛 {profile.get('full_name', 'N/A')}")
    print(f"📝 {profile.get('bio', 'N/A')}")
    print(f"👥 {profile.get('followers', 'N/A')} 追蹤者")
    print(f"✅ 已驗證: {profile.get('is_verified', False)}")

    if threads:
        print(f"\n── 貼文 ({len(threads)}) ──")
        for i, t in enumerate(threads[:10], 1):
            text = t.get("text", "") or ""
            print(f"\n  [{i}] {text[:80]}{'...' if len(text) > 80 else ''}")
            print(f"      ❤️ {t.get('like_count', 0)}  💬 {t.get('reply_count', 0)}  🕐 {t.get('published_on_readable', '')}")
        if len(threads) > 10:
            print(f"\n  ... 還有 {len(threads) - 10} 篇貼文")
    print("=" * 60)


# ── CLI 入口 ──────────────────────────────────────────────


def main():
    usage = """
使用方式:
    python threads_scraper.py post <URL>      抓取單篇貼文
    python threads_scraper.py profile <URL>   抓取用戶頁面

範例:
    python threads_scraper.py post https://www.threads.net/t/C8H5FiCtESk
    python threads_scraper.py profile https://www.threads.net/@natgeo

選項:
    --show      顯示瀏覽器視窗（除錯用）
    --output    指定輸出檔名（預設自動產生）
    """

    if len(sys.argv) < 3:
        print(usage)
        sys.exit(1)

    command = sys.argv[1]
    url = sys.argv[2]
    headless = "--show" not in sys.argv

    # 決定輸出檔名
    output_file = None
    for i, arg in enumerate(sys.argv):
        if arg == "--output" and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]

    try:
        if command == "post":
            data = scrape_thread(url, headless=headless)
            print_thread_summary(data)

            if not output_file:
                code = data["thread"].get("code", "unknown")
                output_file = f"thread_{code}.json"
            save_json(data, output_file)

        elif command == "profile":
            data = scrape_profile(url, headless=headless)
            print_profile_summary(data)

            if not output_file:
                username = (
                    data.get("profile", {}).get("username", "unknown")
                )
                output_file = f"profile_{username}.json"
            save_json(data, output_file)

        else:
            print(f"❌ 未知指令: {command}")
            print(usage)
            sys.exit(1)

    except Exception as e:
        print(f"❌ 錯誤: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
