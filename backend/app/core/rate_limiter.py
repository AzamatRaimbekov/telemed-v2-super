"""Rate limiting middleware using Redis."""
import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from redis.asyncio import Redis
from app.core.redis import redis_pool


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limit API requests per IP/user."""

    def __init__(self, app, requests_per_minute: int = 60, burst: int = 10):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.burst = burst

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for WebSocket, health, and static
        path = request.url.path
        if path.startswith("/ws/") or path.endswith("/health") or not path.startswith("/api/"):
            return await call_next(request)

        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        auth = request.headers.get("authorization", "")
        key = f"rl:{auth[:20] if auth else client_ip}"

        try:
            r = Redis(connection_pool=redis_pool)
            current = await r.get(key)

            if current and int(current) >= self.rpm:
                await r.aclose()
                raise HTTPException(
                    status_code=429,
                    detail="Слишком много запросов. Попробуйте позже.",
                    headers={"Retry-After": "60"},
                )

            pipe = r.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            await pipe.execute()
            await r.aclose()
        except HTTPException:
            raise
        except Exception:
            pass  # If Redis is down, don't block requests

        response = await call_next(request)
        return response
