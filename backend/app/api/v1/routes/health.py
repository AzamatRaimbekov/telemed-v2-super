from __future__ import annotations
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.redis import get_redis

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
async def health_check():
    import os
    stamp = ""
    try:
        with open("/app/.build_stamp") as f:
            stamp = f.read().strip()
    except Exception:
        stamp = "no stamp"
    monitoring_exists = os.path.exists("/app/app/api/v1/routes/monitoring.py")
    return {"status": "ok", "build": stamp, "monitoring_file": monitoring_exists, "deploy": "v2"}

@router.get("/db")
async def health_db(session: AsyncSession = Depends(get_session)):
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}

@router.get("/redis")
async def health_redis(redis: Redis = Depends(get_redis)):
    try:
        await redis.ping()
        return {"status": "ok", "redis": "connected"}
    except Exception as e:
        return {"status": "error", "redis": str(e)}
