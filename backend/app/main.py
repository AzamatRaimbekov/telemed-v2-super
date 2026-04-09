from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import APIError, api_error_handler
from app.core.logging_config import setup_logging
from app.core.middleware import RequestLoggingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield

app = FastAPI(title=settings.APP_NAME, version="1.0.0", docs_url="/docs", openapi_url="/openapi.json", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(APIError, api_error_handler)
app.include_router(api_router)
