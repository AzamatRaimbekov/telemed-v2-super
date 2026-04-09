import time
import uuid
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        await logger.ainfo("request", request_id=request_id, method=request.method, path=str(request.url.path), status_code=response.status_code, duration_ms=duration_ms, client_ip=request.client.host if request.client else None)
        response.headers["X-Request-ID"] = request_id
        return response
