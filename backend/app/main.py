from __future__ import annotations
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import APIError, api_error_handler
from app.core.logging_config import setup_logging
from app.core.middleware import RequestLoggingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # Auto-run migrations on startup in production
    if settings.APP_ENV == "production":
        import subprocess
        # Ensure DB exists
        db_result = subprocess.run(["python", "create_db.py"], capture_output=True, text=True)
        print(f"DB: {db_result.stdout.strip()}")
        if db_result.returncode != 0:
            print(f"DB error: {db_result.stderr[:300]}")
        # Run migrations
        result = subprocess.run(["python", "-m", "alembic", "upgrade", "head"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"Migrations OK")
        else:
            print(f"Migration warning: {result.stderr[:500]}")
    yield

app = FastAPI(title=settings.APP_NAME, version="1.0.0", docs_url="/docs", openapi_url="/openapi.json", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(APIError, api_error_handler)
app.include_router(api_router)

# Serve uploaded files (audio, documents)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
