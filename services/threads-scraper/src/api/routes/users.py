"""
用戶 API
"""

from fastapi import APIRouter, HTTPException, Query
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


@router.get("/users")
async def get_users(limit: int = Query(50, ge=1, le=100)):
    """
    取得用戶列表
    """
    try:
        db = get_db()
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.*, COUNT(p.id) as post_count
            FROM users u
            LEFT JOIN posts p ON u.username = p.username
            GROUP BY u.username
            ORDER BY post_count DESC
            LIMIT %s
        """, (limit,))

        users = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return {
            "success": True,
            "data": {"users": users}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{username}")
async def get_user(username: str):
    """
    取得用戶詳情
    """
    try:
        db = get_db()
        conn = db.get_connection()
        cursor = conn.cursor()

        # 用戶資料
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="用戶不存在")

        # 用戶的貼文
        cursor.execute("""
            SELECT * FROM posts
            WHERE username = %s
            ORDER BY published_on DESC
            LIMIT 20
        """, (username,))
        posts = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {
            "success": True,
            "data": {
                "user": dict(user),
                "posts": posts
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/tracked/list")
async def get_tracked_users():
    """
    取得追蹤中的用戶
    """
    try:
        db = get_db()
        tracked = db.get_tracked_users(active_only=True)
        return {
            "success": True,
            "data": {"tracked_users": tracked}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
