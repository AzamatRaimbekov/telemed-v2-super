"""Redis caching service for frequently accessed data."""
import json
from typing import Any, Optional
from redis.asyncio import Redis
from app.core.redis import redis_pool


class CacheService:
    """Simple Redis cache wrapper."""

    PREFIX = "medcore:"
    DEFAULT_TTL = 300  # 5 minutes

    @staticmethod
    def _get_redis() -> Redis:
        return Redis(connection_pool=redis_pool)

    @staticmethod
    async def get(key: str) -> Optional[Any]:
        """Get cached value."""
        try:
            r = CacheService._get_redis()
            data = await r.get(f"{CacheService.PREFIX}{key}")
            await r.aclose()
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None

    @staticmethod
    async def set(key: str, value: Any, ttl: int = DEFAULT_TTL):
        """Set cached value with TTL."""
        try:
            r = CacheService._get_redis()
            await r.set(f"{CacheService.PREFIX}{key}", json.dumps(value, default=str), ex=ttl)
            await r.aclose()
        except Exception:
            pass

    @staticmethod
    async def delete(key: str):
        """Delete cached key."""
        try:
            r = CacheService._get_redis()
            await r.delete(f"{CacheService.PREFIX}{key}")
            await r.aclose()
        except Exception:
            pass

    @staticmethod
    async def invalidate_pattern(pattern: str):
        """Delete all keys matching pattern."""
        try:
            r = CacheService._get_redis()
            keys = await r.keys(f"{CacheService.PREFIX}{pattern}")
            if keys:
                await r.delete(*keys)
            await r.aclose()
        except Exception:
            pass

    @staticmethod
    async def get_or_set(key: str, factory, ttl: int = DEFAULT_TTL) -> Any:
        """Get from cache or compute and store."""
        cached = await CacheService.get(key)
        if cached is not None:
            return cached
        value = await factory()
        await CacheService.set(key, value, ttl)
        return value
