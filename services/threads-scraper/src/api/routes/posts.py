"""
貼文 API
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from src.core.database import ThreadsDatabase
from src.core.config_loader import get_database_path
import os

router = APIRouter()


def get_db():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return ThreadsDatabase(db_url)
    else:
        from src.core.database_sqlite import ThreadsDatabase as SQLiteDB
        return SQLiteDB(get_database_path())


@router.get("/posts")
async def get_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    keyword: Optional[str] = None,
    keywords_only: bool = Query(False, description="只顯示符合 config.yaml 中關鍵字的貼文")
):
    """
    取得貼文列表

    - **limit**: 每頁數量（1-100）
    - **offset**: 偏移量
    - **keyword**: 關鍵字過濾（單一關鍵字）
    - **keywords_only**: 只顯示符合設定檔中關鍵字的貼文
    """
    try:
        db = get_db()
        conn = db.get_connection()
        cursor = conn.cursor()

        # 基本查詢
        query = "SELECT * FROM posts ORDER BY published_on DESC LIMIT %s OFFSET %s"

        cursor.execute(query, (limit, offset))
        posts = [dict(row) for row in cursor.fetchall()]

        # 關鍵字過濾
        if keyword:
            posts = [p for p in posts if keyword.lower() in (p.get("text") or "").lower()]

        # 使用設定檔中的關鍵字過濾
        if keywords_only:
            from src.core.config_loader import load_config
            config = load_config("config/config.yaml")
            config_keywords = config.get("keywords", [])
            if config_keywords:
                filtered_posts = []
                for p in posts:
                    text = (p.get("text") or "").lower()
                    if any(kw.lower() in text for kw in config_keywords):
                        filtered_posts.append(p)
                posts = filtered_posts

        # 取得總數
        cursor.execute("SELECT COUNT(*) as count FROM posts")
        total = cursor.fetchone()['count']

        conn.close()

        return {
            "success": True,
            "data": {
                "posts": posts,
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """
    取得單篇貼文詳情
    """
    try:
        db = get_db()
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM posts WHERE id = %s", (post_id,))
        post = cursor.fetchone()

        if not post:
            raise HTTPException(status_code=404, detail="貼文不存在")

        # 取得回覆
        cursor.execute("""
            SELECT * FROM replies
            WHERE parent_post_id = %s
            ORDER BY published_on DESC
        """, (post_id,))
        replies = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {
            "success": True,
            "data": {
                "post": dict(post),
                "replies": replies
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/search")
async def search_posts(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100)
):
    """
    搜尋貼文

    - **q**: 搜尋關鍵字
    - **limit**: 返回數量
    """
    try:
        db = get_db()
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM posts
            WHERE text ILIKE %s
            ORDER BY published_on DESC
            LIMIT %s
        """, (f"%{q}%", limit))

        posts = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return {
            "success": True,
            "data": {
                "keyword": q,
                "posts": posts,
                "count": len(posts)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
