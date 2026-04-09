from redis.asyncio import ConnectionPool, Redis
from app.core.config import settings

redis_pool = ConnectionPool.from_url(settings.redis_url, max_connections=20, decode_responses=True)

async def get_redis() -> Redis:
    redis = Redis(connection_pool=redis_pool)
    try:
        yield redis
    finally:
        await redis.aclose()
