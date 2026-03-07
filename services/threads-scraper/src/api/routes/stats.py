"""
統計資訊 API
"""

from fastapi import APIRouter, HTTPException
from src.core.database import ThreadsDatabase
from src.core.config_loader import get_database_path
import os

router = APIRouter()


def get_db():
    """取得資料庫實例"""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return ThreadsDatabase(db_url)
    else:
        # 降級使用 SQLite
        from src.core.database_sqlite import ThreadsDatabase as SQLiteDB
        return SQLiteDB(get_database_path())


@router.get("/stats")
async def get_stats():
    """
    取得整體統計資訊
    """
    try:
        db = get_db()
        stats = db.get_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/users")
async def get_user_stats():
    """
    取得用戶統計
    """
    try:
        db = get_db()
        tracked = db.get_tracked_users(active_only=True)
        return {
            "success": True,
            "data": {
                "total_tracked": len(tracked),
                "auto_discovered": sum(1 for u in tracked if u["discovered_from"] != "manual"),
                "manual_added": sum(1 for u in tracked if u["discovered_from"] == "manual"),
                "users": tracked
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
