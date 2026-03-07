"""
FastAPI 應用 - 用於查看抓取的資料
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import stats, posts, users

app = FastAPI(
    title="Threads Scraper API",
    description="查看 Threads 抓取的資料",
    version="1.0.0"
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(stats.router, prefix="/api", tags=["統計"])
app.include_router(posts.router, prefix="/api", tags=["貼文"])
app.include_router(users.router, prefix="/api", tags=["用戶"])


@app.get("/")
async def root():
    return {
        "message": "Threads Scraper API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
