import sqlite3
import json

def check_db():
    conn = sqlite3.connect("threads_data.db")
    cursor = conn.cursor()
    
    # Latest 5 posts
    print("\n--- Latest 5 Posts (最新貼文) ---")
    try:
        cursor.execute("SELECT username, text, published_on_readable, like_count FROM posts ORDER BY scraped_at DESC LIMIT 5")
        posts = cursor.fetchall()
        for p in posts:
            print(f"User: @{p[0]}")
            content = p[1].replace('\n', ' ')[:100] if p[1] else "(Empty)"
            print(f"Content: {content}...")
            print(f"Likes: {p[3]} | Time: {p[2]}")
            print("-" * 20)
    except Exception as e:
        print(f"Error reading posts: {e}")

    # Tracked users
    print("\n--- Tracked Users (追蹤清單) ---")
    try:
        cursor.execute("SELECT username, last_scraped FROM tracked_users")
        users = cursor.fetchall()
        for u in users:
            print(f"User: @{u[0]} | Last Scraped: {u[1]}")
    except Exception as e:
        print(f"Error reading users: {e}")

    conn.close()

if __name__ == "__main__":
    check_db()
