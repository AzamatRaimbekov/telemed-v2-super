# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete infrastructure (Docker, DB, Auth, Frontend shell) so every future module has a working foundation to plug into.

**Architecture:** FastAPI backend with async SQLAlchemy 2.0, repository→service→route layers, JWT auth with Redis blacklist, multi-tenant via clinic_id. React frontend with TanStack Router/Query, Zustand auth store, shadcn/ui, Tailwind with custom color system.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Redis, Celery, PostgreSQL 16, React 18, Vite, TanStack Router v1, TanStack Query v5, Zustand, Tailwind CSS v3, shadcn/ui

---

## File Structure

### Backend
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI app factory, middleware, exception handlers
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                      # get_db, get_current_user, require_role
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py                # Aggregates all v1 route modules
│   │       └── routes/
│   │           ├── __init__.py
│   │           ├── auth.py              # login, logout, refresh, me
│   │           ├── users.py             # CRUD users (admin)
│   │           ├── clinics.py           # CRUD clinics (super_admin)
│   │           └── health.py            # health, health/db, health/redis
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    # Pydantic Settings from env
│   │   ├── security.py                  # JWT encode/decode, password hash/verify
│   │   ├── database.py                  # Async engine, sessionmaker, get_session
│   │   ├── redis.py                     # Redis pool, get_redis
│   │   ├── exceptions.py               # APIError hierarchy
│   │   ├── middleware.py                # TenantMiddleware, RequestLoggingMiddleware
│   │   └── logging_config.py           # Structured JSON logging setup
│   ├── models/
│   │   ├── __init__.py                  # Import all models for Alembic
│   │   ├── base.py                      # BaseMixin, Base declarative
│   │   ├── clinic.py                    # Clinic
│   │   ├── user.py                      # User, Role, Permission, RolePermission
│   │   ├── patient.py                   # Patient, PatientGuardian
│   │   ├── medical.py                   # MedicalCard, Visit
│   │   ├── treatment.py                 # TreatmentPlan, TreatmentPlanItem
│   │   ├── medication.py               # Drug, Prescription, PrescriptionItem, Inventory, Supplier, PurchaseOrder
│   │   ├── laboratory.py               # LabTestCatalog, LabOrder, LabResult
│   │   ├── procedure.py                # Procedure, ProcedureOrder
│   │   ├── exercise.py                 # Exercise, ExerciseSession, ExerciseRep
│   │   ├── staff.py                    # StaffSchedule, Shift, Attendance
│   │   ├── billing.py                  # Invoice, InvoiceItem, Payment
│   │   ├── appointment.py              # Appointment
│   │   ├── notification.py             # Notification
│   │   ├── stroke.py                   # StrokeAssessment, RehabGoal, RehabProgress
│   │   ├── facility.py                 # Department, Room, Bed, BedAssignment
│   │   ├── telemedicine.py             # TelemedicineSession, Message
│   │   ├── face.py                     # FaceSnapshot, FaceEmbedding
│   │   └── audit.py                    # AuditLog
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                      # LoginRequest, TokenResponse, UserResponse
│   │   ├── user.py                      # UserCreate, UserUpdate, UserOut
│   │   ├── clinic.py                    # ClinicCreate, ClinicUpdate, ClinicOut
│   │   └── common.py                    # PaginatedResponse, ErrorResponse, CursorParams
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth.py                      # AuthService: login, logout, refresh
│   │   ├── user.py                      # UserService: CRUD
│   │   └── clinic.py                    # ClinicService: CRUD
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py                      # BaseRepository generic CRUD
│   │   ├── user.py                      # UserRepository
│   │   └── clinic.py                    # ClinicRepository
│   └── tasks/
│       ├── __init__.py
│       └── celery_app.py               # Celery config
├── alembic/
│   ├── env.py
│   └── versions/                        # Migration files
├── alembic.ini
├── seed.py                              # Demo data seeder
├── requirements.txt
└── Dockerfile
```

### Frontend
```
frontend/
├── src/
│   ├── main.tsx                         # React root, providers
│   ├── App.tsx                          # TanStack Router setup
│   ├── routeTree.gen.ts                 # Auto-generated route tree
│   ├── routes/
│   │   ├── __root.tsx                   # Root layout, Toaster, QueryClientProvider
│   │   ├── login.tsx                    # Login page
│   │   ├── _authenticated.tsx           # Auth guard layout
│   │   └── _authenticated/
│   │       └── dashboard.tsx            # Dashboard placeholder
│   ├── components/
│   │   ├── ui/                          # shadcn/ui (button, input, label, card, form, skeleton, alert, dropdown-menu, avatar, separator, toast/sonner)
│   │   └── shared/
│   │       ├── loading-skeleton.tsx      # Reusable page skeleton
│   │       ├── error-boundary.tsx        # Error boundary wrapper
│   │       ├── page-header.tsx           # Page title + breadcrumb
│   │       └── require-role.tsx          # Role gate component
│   ├── features/
│   │   └── auth/
│   │       ├── components/
│   │       │   └── login-form.tsx
│   │       ├── hooks/
│   │       │   └── use-auth.ts
│   │       └── api.ts                    # Auth API calls
│   ├── stores/
│   │   └── auth-store.ts               # Zustand auth store
│   ├── hooks/
│   │   └── use-toast.ts                # Re-export sonner
│   ├── lib/
│   │   ├── api-client.ts               # Axios instance + interceptors
│   │   ├── query-client.ts             # TanStack Query client
│   │   └── utils.ts                    # cn(), formatDate, formatCurrency
│   └── types/
│       ├── auth.ts                      # User, LoginRequest, TokenResponse
│       └── api.ts                       # APIError, PaginatedResponse
├── index.html
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── components.json                      # shadcn/ui config
├── package.json
└── Dockerfile
```

### Root
```
medcore-kg/ (project root = /Users/azamat/Desktop/telemed-v2-super)
├── backend/
├── frontend/
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .env
└── .gitignore
```

---

## Task 1: Project Scaffolding & Docker Infrastructure

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env`
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `nginx/nginx.conf`
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `frontend/Dockerfile`
- Create: `frontend/package.json`

- [ ] **Step 1: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.eggs/
dist/
build/
*.egg
.venv/
venv/

# Node
node_modules/
dist/
.vite/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
docker-compose.override.yml

# Alembic
alembic/versions/__pycache__/

# Coverage
htmlcov/
.coverage
coverage.xml

# MinIO data
minio_data/

# Redis data
redis_data/

# Postgres data
postgres_data/
```

- [ ] **Step 2: Create .env.example and .env**

`.env.example` (and copy to `.env` with same values for dev):

```bash
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=medcore
POSTGRES_USER=medcore
POSTGRES_PASSWORD=medcore_secret

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET_KEY=dev-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_ALGORITHM=HS256

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=medcore
MINIO_USE_SSL=false

# Celery
CELERY_BROKER_URL=redis://redis:6379/2
CELERY_RESULT_BACKEND=redis://redis:6379/2

# App
APP_NAME=MedCore KG
APP_ENV=development
APP_DEBUG=true
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=["http://localhost:5173","http://localhost:80","http://localhost:3000"]

# Sentry (optional)
SENTRY_DSN=
```

- [ ] **Step 3: Create backend/requirements.txt**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
gunicorn==23.0.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1
pydantic==2.10.4
pydantic-settings==2.7.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.20
redis[hiredis]==5.2.1
celery[redis]==5.4.0
httpx==0.28.1
pillow==11.1.0
python-dotenv==1.0.1
structlog==24.4.0
sentry-sdk[fastapi]==2.19.2
minio==7.2.12
```

- [ ] **Step 4: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 5: Create frontend/package.json**

```json
{
  "name": "medcore-kg-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-router": "^1.95.1",
    "@tanstack/react-query": "^5.62.8",
    "zustand": "^5.0.2",
    "axios": "^1.7.9",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^3.9.1",
    "zod": "^3.24.1",
    "sonner": "^1.7.2",
    "framer-motion": "^11.15.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.468.0",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@tanstack/router-plugin": "^1.95.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "eslint": "^9.17.0",
    "@eslint/js": "^9.17.0",
    "typescript-eslint": "^8.18.2"
  }
}
```

- [ ] **Step 6: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

- [ ] **Step 7: Create nginx/nginx.conf**

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:5173;
}

server {
    listen 80;
    server_name localhost;

    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }

    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 8: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_started

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
      - frontend

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info
    env_file: .env
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app beat --loglevel=info
    env_file: .env
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

- [ ] **Step 9: Create docker-compose.prod.yml**

```yaml
services:
  backend:
    command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
    volumes: []
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    volumes: []
    restart: always

  nginx:
    restart: always

  postgres:
    restart: always

  redis:
    restart: always

  celery-worker:
    volumes: []
    restart: always

  celery-beat:
    volumes: []
    restart: always
```

- [ ] **Step 10: Commit scaffolding**

```bash
git add -A
git commit -m "feat: project scaffolding - Docker, nginx, env config"
```

---

## Task 2: Backend Core — Config, Database, Redis, Logging, Exceptions

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/redis.py`
- Create: `backend/app/core/exceptions.py`
- Create: `backend/app/core/logging_config.py`

- [ ] **Step 1: Create empty __init__.py files for package structure**

Create these empty files:
- `backend/app/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/api/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/routes/__init__.py`
- `backend/app/models/__init__.py`
- `backend/app/schemas/__init__.py`
- `backend/app/services/__init__.py`
- `backend/app/repositories/__init__.py`
- `backend/app/tasks/__init__.py`

- [ ] **Step 2: Create backend/app/core/config.py**

```python
from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MedCore KG"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "medcore"
    POSTGRES_USER: str = "medcore"
    POSTGRES_PASSWORD: str = "medcore_secret"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "medcore"
    MINIO_USE_SSL: bool = False

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:80"]

    # Sentry
    SENTRY_DSN: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
```

- [ ] **Step 3: Create backend/app/core/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.APP_DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

- [ ] **Step 4: Create backend/app/core/redis.py**

```python
from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

redis_pool = ConnectionPool.from_url(
    settings.redis_url,
    max_connections=20,
    decode_responses=True,
)


async def get_redis() -> Redis:  # type: ignore[misc]
    redis = Redis(connection_pool=redis_pool)
    try:
        yield redis
    finally:
        await redis.aclose()
```

- [ ] **Step 5: Create backend/app/core/exceptions.py**

```python
from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(
        self,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        message: str = "An internal error occurred",
        details: dict | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.details = details or {}


class NotFoundError(APIError):
    def __init__(self, resource: str = "Resource", resource_id: str = "") -> None:
        super().__init__(
            status_code=404,
            error_code=f"{resource.upper()}_NOT_FOUND",
            message=f"{resource} not found" + (f": {resource_id}" if resource_id else ""),
        )


class ValidationError(APIError):
    def __init__(self, message: str = "Validation failed", details: dict | None = None) -> None:
        super().__init__(status_code=422, error_code="VALIDATION_ERROR", message=message, details=details)


class AuthenticationError(APIError):
    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(status_code=401, error_code="AUTHENTICATION_ERROR", message=message)


class ForbiddenError(APIError):
    def __init__(self, message: str = "Access denied") -> None:
        super().__init__(status_code=403, error_code="FORBIDDEN", message=message)


class ConflictError(APIError):
    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(status_code=409, error_code="CONFLICT", message=message)


class RateLimitError(APIError):
    def __init__(self) -> None:
        super().__init__(status_code=429, error_code="RATE_LIMITED", message="Too many requests")


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )
```

- [ ] **Step 6: Create backend/app/core/logging_config.py**

```python
import logging
import sys

import structlog


def setup_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )
```

- [ ] **Step 7: Commit backend core**

```bash
git add backend/
git commit -m "feat: backend core - config, database, redis, exceptions, logging"
```

---

## Task 3: SQLAlchemy Models — All 50+ Tables

**Files:**
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/clinic.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/patient.py`
- Create: `backend/app/models/medical.py`
- Create: `backend/app/models/treatment.py`
- Create: `backend/app/models/medication.py`
- Create: `backend/app/models/laboratory.py`
- Create: `backend/app/models/procedure.py`
- Create: `backend/app/models/exercise.py`
- Create: `backend/app/models/staff.py`
- Create: `backend/app/models/billing.py`
- Create: `backend/app/models/appointment.py`
- Create: `backend/app/models/notification.py`
- Create: `backend/app/models/stroke.py`
- Create: `backend/app/models/facility.py`
- Create: `backend/app/models/telemedicine.py`
- Create: `backend/app/models/face.py`
- Create: `backend/app/models/audit.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create backend/app/models/base.py**

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BaseMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class TenantMixin(BaseMixin):
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
```

- [ ] **Step 2: Create backend/app/models/clinic.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseMixin


class SubscriptionPlan(str, enum.Enum):
    FREE = "FREE"
    BASIC = "BASIC"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class Clinic(BaseMixin, Base):
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    working_hours: Mapped[dict | None] = mapped_column(JSON)
    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), default=SubscriptionPlan.FREE
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict | None] = mapped_column(JSON)

    # No clinic_id — clinics is the top-level tenant table
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    users = relationship("User", back_populates="clinic", lazy="selectin")
```

- [ ] **Step 3: Create backend/app/models/user.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    CLINIC_ADMIN = "CLINIC_ADMIN"
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"
    PHARMACIST = "PHARMACIST"
    RECEPTIONIST = "RECEPTIONIST"
    LAB_TECHNICIAN = "LAB_TECHNICIAN"
    PATIENT = "PATIENT"
    GUARDIAN = "GUARDIAN"


class PermissionAction(str, enum.Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MANAGE = "MANAGE"


class User(TenantMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    specialization: Mapped[str | None] = mapped_column(String(255))
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    clinic = relationship("Clinic", back_populates="users", lazy="selectin")


class Role(TenantMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    permissions = relationship("RolePermission", back_populates="role", lazy="selectin")


class Permission(TenantMixin, Base):
    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[PermissionAction] = mapped_column(Enum(PermissionAction), nullable=False)


class RolePermission(TenantMixin, Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False
    )

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission")
```

- [ ] **Step 4: Create backend/app/models/patient.py**

```python
import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class BloodType(str, enum.Enum):
    A_POS = "A_POS"
    A_NEG = "A_NEG"
    B_POS = "B_POS"
    B_NEG = "B_NEG"
    AB_POS = "AB_POS"
    AB_NEG = "AB_NEG"
    O_POS = "O_POS"
    O_NEG = "O_NEG"
    UNKNOWN = "UNKNOWN"


class RegistrationSource(str, enum.Enum):
    WALK_IN = "WALK_IN"
    ONLINE = "ONLINE"
    REFERRAL = "REFERRAL"
    EMERGENCY = "EMERGENCY"


class PatientStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISCHARGED = "DISCHARGED"
    DECEASED = "DECEASED"
    TRANSFERRED = "TRANSFERRED"


class Patient(TenantMixin, Base):
    __tablename__ = "patients"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[Gender] = mapped_column(Enum(Gender), nullable=False)
    passport_number: Mapped[str | None] = mapped_column(String(50), index=True)
    inn: Mapped[str | None] = mapped_column(String(50), index=True)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(50))
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50))
    blood_type: Mapped[BloodType] = mapped_column(Enum(BloodType), default=BloodType.UNKNOWN)
    allergies: Mapped[list | None] = mapped_column(JSON)
    chronic_conditions: Mapped[list | None] = mapped_column(JSON)
    insurance_provider: Mapped[str | None] = mapped_column(String(255))
    insurance_number: Mapped[str | None] = mapped_column(String(100))
    assigned_doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    assigned_nurse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    photo_url: Mapped[str | None] = mapped_column(String(500))
    registration_source: Mapped[RegistrationSource] = mapped_column(
        Enum(RegistrationSource), default=RegistrationSource.WALK_IN
    )
    status: Mapped[PatientStatus] = mapped_column(Enum(PatientStatus), default=PatientStatus.ACTIVE)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    assigned_doctor = relationship("User", foreign_keys=[assigned_doctor_id], lazy="selectin")
    assigned_nurse = relationship("User", foreign_keys=[assigned_nurse_id], lazy="selectin")
    medical_card = relationship("MedicalCard", back_populates="patient", uselist=False, lazy="selectin")
    guardians = relationship("PatientGuardian", back_populates="patient", lazy="selectin")


class PatientGuardian(TenantMixin, Base):
    __tablename__ = "patient_guardians"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    guardian_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)

    patient = relationship("Patient", back_populates="guardians")
    guardian = relationship("User", lazy="selectin")
```

- [ ] **Step 5: Create backend/app/models/medical.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class VisitType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    FOLLOW_UP = "FOLLOW_UP"
    EMERGENCY = "EMERGENCY"
    TELEMEDICINE = "TELEMEDICINE"
    PROCEDURE = "PROCEDURE"


class VisitStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class MedicalCard(TenantMixin, Base):
    __tablename__ = "medical_cards"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False
    )
    card_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    patient = relationship("Patient", back_populates="medical_card")
    visits = relationship("Visit", back_populates="medical_card", lazy="selectin")


class Visit(TenantMixin, Base):
    __tablename__ = "visits"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    medical_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medical_cards.id"), nullable=False
    )
    visit_type: Mapped[VisitType] = mapped_column(Enum(VisitType), nullable=False)
    status: Mapped[VisitStatus] = mapped_column(Enum(VisitStatus), default=VisitStatus.SCHEDULED)
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    examination_notes: Mapped[str | None] = mapped_column(Text)
    diagnosis_codes: Mapped[list | None] = mapped_column(JSON)
    diagnosis_text: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    medical_card = relationship("MedicalCard", back_populates="visits")
    doctor = relationship("User", lazy="selectin")
```

- [ ] **Step 6: Create backend/app/models/treatment.py**

```python
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class TreatmentPlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TreatmentItemType(str, enum.Enum):
    MEDICATION = "MEDICATION"
    PROCEDURE = "PROCEDURE"
    LAB_TEST = "LAB_TEST"
    THERAPY = "THERAPY"
    EXERCISE = "EXERCISE"
    DIET = "DIET"
    MONITORING = "MONITORING"


class TreatmentItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TreatmentPlan(TenantMixin, Base):
    __tablename__ = "treatment_plans"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TreatmentPlanStatus] = mapped_column(
        Enum(TreatmentPlanStatus), default=TreatmentPlanStatus.DRAFT
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)

    items = relationship("TreatmentPlanItem", back_populates="treatment_plan", lazy="selectin")


class TreatmentPlanItem(TenantMixin, Base):
    __tablename__ = "treatment_plan_items"

    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=False
    )
    item_type: Mapped[TreatmentItemType] = mapped_column(Enum(TreatmentItemType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    configuration: Mapped[dict | None] = mapped_column(JSON)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    frequency: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[TreatmentItemStatus] = mapped_column(
        Enum(TreatmentItemStatus), default=TreatmentItemStatus.PENDING
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)

    treatment_plan = relationship("TreatmentPlan", back_populates="items")
```

- [ ] **Step 7: Create backend/app/models/medication.py**

```python
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class DrugForm(str, enum.Enum):
    TABLET = "TABLET"
    CAPSULE = "CAPSULE"
    INJECTION = "INJECTION"
    SYRUP = "SYRUP"
    CREAM = "CREAM"
    DROPS = "DROPS"
    INHALER = "INHALER"
    OTHER = "OTHER"


class PrescriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class MedicationRoute(str, enum.Enum):
    ORAL = "ORAL"
    IV = "IV"
    IM = "IM"
    TOPICAL = "TOPICAL"
    SUBLINGUAL = "SUBLINGUAL"
    RECTAL = "RECTAL"
    INHALATION = "INHALATION"
    OTHER = "OTHER"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class Drug(TenantMixin, Base):
    __tablename__ = "drugs"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(255))
    brand: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(100))
    form: Mapped[DrugForm] = mapped_column(Enum(DrugForm), default=DrugForm.TABLET)
    unit: Mapped[str | None] = mapped_column(String(50))
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=True)
    interactions: Mapped[list | None] = mapped_column(JSON)
    contraindications: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Prescription(TenantMixin, Base):
    __tablename__ = "prescriptions"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"))
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"))
    status: Mapped[PrescriptionStatus] = mapped_column(Enum(PrescriptionStatus), default=PrescriptionStatus.ACTIVE)
    notes: Mapped[str | None] = mapped_column(Text)
    prescribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    items = relationship("PrescriptionItem", back_populates="prescription", lazy="selectin")


class PrescriptionItem(TenantMixin, Base):
    __tablename__ = "prescription_items"

    prescription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    route: Mapped[MedicationRoute] = mapped_column(Enum(MedicationRoute), default=MedicationRoute.ORAL)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_prn: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(String(500))

    prescription = relationship("Prescription", back_populates="items")
    drug = relationship("Drug", lazy="selectin")


class Supplier(TenantMixin, Base):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)


class Inventory(TenantMixin, Base):
    __tablename__ = "inventory"

    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    batch_number: Mapped[str | None] = mapped_column(String(100))
    expiry_date: Mapped[date | None] = mapped_column(Date)
    purchase_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    location: Mapped[str | None] = mapped_column(String(100))

    drug = relationship("Drug", lazy="selectin")
    supplier = relationship("Supplier", lazy="selectin")


class PurchaseOrder(TenantMixin, Base):
    __tablename__ = "purchase_orders"

    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    items: Mapped[list | None] = mapped_column(JSON)
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

- [ ] **Step 8: Create backend/app/models/laboratory.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class LabPriority(str, enum.Enum):
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"
    STAT = "STAT"


class LabOrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    SAMPLE_COLLECTED = "SAMPLE_COLLECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class LabResultStatus(str, enum.Enum):
    PRELIMINARY = "PRELIMINARY"
    FINAL = "FINAL"
    AMENDED = "AMENDED"


class LabTestCatalog(TenantMixin, Base):
    __tablename__ = "lab_tests_catalog"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    reference_ranges: Mapped[dict | None] = mapped_column(JSON)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    turnaround_hours: Mapped[int] = mapped_column(Integer, default=24)
    sample_type: Mapped[str | None] = mapped_column(String(50))


class LabOrder(TenantMixin, Base):
    __tablename__ = "lab_orders"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"))
    test_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_tests_catalog.id"), nullable=False)
    priority: Mapped[LabPriority] = mapped_column(Enum(LabPriority), default=LabPriority.ROUTINE)
    status: Mapped[LabOrderStatus] = mapped_column(Enum(LabOrderStatus), default=LabOrderStatus.ORDERED)
    notes: Mapped[str | None] = mapped_column(Text)
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    test = relationship("LabTestCatalog", lazy="selectin")
    result = relationship("LabResult", back_populates="lab_order", uselist=False, lazy="selectin")


class LabResult(TenantMixin, Base):
    __tablename__ = "lab_results"

    lab_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False)
    performed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    numeric_value: Mapped[float | None] = mapped_column(Numeric(12, 4))
    unit: Mapped[str | None] = mapped_column(String(50))
    reference_range: Mapped[str | None] = mapped_column(String(100))
    is_abnormal: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    attachment_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[LabResultStatus] = mapped_column(Enum(LabResultStatus), default=LabResultStatus.PRELIMINARY)
    resulted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lab_order = relationship("LabOrder", back_populates="result")
```

- [ ] **Step 9: Create backend/app/models/procedure.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class ProcedureOrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Procedure(TenantMixin, Base):
    __tablename__ = "procedures"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    requires_consent: Mapped[bool] = mapped_column(Boolean, default=False)


class ProcedureOrder(TenantMixin, Base):
    __tablename__ = "procedure_orders"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    procedure_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("procedures.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"))
    status: Mapped[ProcedureOrderStatus] = mapped_column(Enum(ProcedureOrderStatus), default=ProcedureOrderStatus.ORDERED)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    consent_signed: Mapped[bool] = mapped_column(Boolean, default=False)

    procedure = relationship("Procedure", lazy="selectin")
```

- [ ] **Step 10: Create backend/app/models/exercise.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class ExerciseCategory(str, enum.Enum):
    UPPER_LIMB = "UPPER_LIMB"
    LOWER_LIMB = "LOWER_LIMB"
    BALANCE = "BALANCE"
    GAIT = "GAIT"
    COGNITIVE = "COGNITIVE"


class ExerciseDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class Exercise(TenantMixin, Base):
    __tablename__ = "exercises"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[ExerciseCategory] = mapped_column(Enum(ExerciseCategory), nullable=False)
    difficulty: Mapped[ExerciseDifficulty] = mapped_column(Enum(ExerciseDifficulty), default=ExerciseDifficulty.EASY)
    target_joints: Mapped[list | None] = mapped_column(JSON)
    angle_thresholds: Mapped[dict | None] = mapped_column(JSON)
    demo_video_url: Mapped[str | None] = mapped_column(String(500))
    instructions: Mapped[str | None] = mapped_column(Text)
    default_sets: Mapped[int] = mapped_column(Integer, default=3)
    default_reps: Mapped[int] = mapped_column(Integer, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ExerciseSession(TenantMixin, Base):
    __tablename__ = "exercise_sessions"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    exercise_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    treatment_plan_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plan_items.id"))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    reps_completed: Mapped[int] = mapped_column(Integer, default=0)
    sets_completed: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    feedback: Mapped[list | None] = mapped_column(JSON)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    exercise = relationship("Exercise", lazy="selectin")
    reps = relationship("ExerciseRep", back_populates="session", lazy="selectin")


class ExerciseRep(TenantMixin, Base):
    __tablename__ = "exercise_reps"

    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercise_sessions.id"), nullable=False)
    rep_number: Mapped[int] = mapped_column(Integer, nullable=False)
    max_angle: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    min_angle: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    form_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    feedback: Mapped[str | None] = mapped_column(String(500))

    session = relationship("ExerciseSession", back_populates="reps")
```

- [ ] **Step 11: Create backend/app/models/staff.py**

```python
import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class ShiftType(str, enum.Enum):
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    NIGHT = "NIGHT"
    ON_CALL = "ON_CALL"


class ShiftStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ABSENT = "ABSENT"


class StaffSchedule(TenantMixin, Base):
    __tablename__ = "staff_schedules"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)


class Shift(TenantMixin, Base):
    __tablename__ = "shifts"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    shift_type: Mapped[ShiftType] = mapped_column(Enum(ShiftType), nullable=False)
    status: Mapped[ShiftStatus] = mapped_column(Enum(ShiftStatus), default=ShiftStatus.SCHEDULED)


class Attendance(TenantMixin, Base):
    __tablename__ = "attendance"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    qr_code: Mapped[str | None] = mapped_column(String(255))
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2))
```

- [ ] **Step 12: Create backend/app/models/billing.py**

```python
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"


class InsuranceClaimStatus(str, enum.Enum):
    NONE = "NONE"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class InvoiceItemType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    PROCEDURE = "PROCEDURE"
    LAB_TEST = "LAB_TEST"
    MEDICATION = "MEDICATION"
    ROOM = "ROOM"
    OTHER = "OTHER"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    INSURANCE = "INSURANCE"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class Invoice(TenantMixin, Base):
    __tablename__ = "invoices"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"))
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"))
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    insurance_claim_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    insurance_claim_status: Mapped[InsuranceClaimStatus | None] = mapped_column(Enum(InsuranceClaimStatus))
    foms_claim_number: Mapped[str | None] = mapped_column(String(100))
    due_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    items = relationship("InvoiceItem", back_populates="invoice", lazy="selectin")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")


class InvoiceItem(TenantMixin, Base):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    item_type: Mapped[InvoiceItemType] = mapped_column(Enum(InvoiceItemType), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    invoice = relationship("Invoice", back_populates="items")


class Payment(TenantMixin, Base):
    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    invoice = relationship("Invoice", back_populates="payments")
```

- [ ] **Step 13: Create backend/app/models/appointment.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class AppointmentType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    FOLLOW_UP = "FOLLOW_UP"
    PROCEDURE = "PROCEDURE"
    TELEMEDICINE = "TELEMEDICINE"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class Appointment(TenantMixin, Base):
    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    appointment_type: Mapped[AppointmentType] = mapped_column(Enum(AppointmentType), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_walk_in: Mapped[bool] = mapped_column(Boolean, default=False)
    queue_number: Mapped[int | None] = mapped_column(Integer)

    patient = relationship("Patient", lazy="selectin")
    doctor = relationship("User", lazy="selectin")
```

- [ ] **Step 14: Create backend/app/models/notification.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class NotificationType(str, enum.Enum):
    PATIENT_ASSIGNED = "PATIENT_ASSIGNED"
    LAB_RESULT_READY = "LAB_RESULT_READY"
    MEDICATION_DUE = "MEDICATION_DUE"
    APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER"
    LOW_STOCK = "LOW_STOCK"
    TREATMENT_UPDATED = "TREATMENT_UPDATED"
    ABNORMAL_RESULT = "ABNORMAL_RESULT"
    ALLERGY_ALERT = "ALLERGY_ALERT"
    SYSTEM = "SYSTEM"


class NotificationSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class Notification(TenantMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[NotificationSeverity] = mapped_column(Enum(NotificationSeverity), default=NotificationSeverity.INFO)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reference_type: Mapped[str | None] = mapped_column(String(50))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    data: Mapped[dict | None] = mapped_column(JSON)
```

- [ ] **Step 15: Create backend/app/models/stroke.py**

```python
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class AssessmentType(str, enum.Enum):
    NIHSS = "NIHSS"
    MRS = "MRS"
    BARTHEL = "BARTHEL"
    MMSE = "MMSE"
    BECK_DEPRESSION = "BECK_DEPRESSION"
    DYSPHAGIA = "DYSPHAGIA"


class RehabDomain(str, enum.Enum):
    MOBILITY = "MOBILITY"
    SPEECH = "SPEECH"
    COGNITION = "COGNITION"
    ADL = "ADL"
    PSYCHOLOGICAL = "PSYCHOLOGICAL"
    SOCIAL = "SOCIAL"


class GoalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACHIEVED = "ACHIEVED"
    PARTIALLY_ACHIEVED = "PARTIALLY_ACHIEVED"
    NOT_ACHIEVED = "NOT_ACHIEVED"
    REVISED = "REVISED"


class StrokeAssessment(TenantMixin, Base):
    __tablename__ = "stroke_assessments"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    assessed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assessment_type: Mapped[AssessmentType] = mapped_column(Enum(AssessmentType), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    max_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    responses: Mapped[dict | None] = mapped_column(JSON)
    interpretation: Mapped[str | None] = mapped_column(String(255))
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class RehabGoal(TenantMixin, Base):
    __tablename__ = "rehab_goals"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"))
    domain: Mapped[RehabDomain] = mapped_column(Enum(RehabDomain), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    baseline_value: Mapped[str | None] = mapped_column(String(255))
    target_value: Mapped[str] = mapped_column(String(255), nullable=False)
    current_value: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[GoalStatus] = mapped_column(Enum(GoalStatus), default=GoalStatus.ACTIVE)
    set_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class RehabProgress(TenantMixin, Base):
    __tablename__ = "rehab_progress"

    goal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rehab_goals.id"), nullable=False)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

- [ ] **Step 16: Create backend/app/models/facility.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class RoomType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    WARD = "WARD"
    ICU = "ICU"
    OPERATING = "OPERATING"
    LAB = "LAB"
    PHARMACY = "PHARMACY"
    RECEPTION = "RECEPTION"
    OTHER = "OTHER"


class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"
    RESERVED = "RESERVED"


class Department(TenantMixin, Base):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    head_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    rooms = relationship("Room", back_populates="department", lazy="selectin")


class Room(TenantMixin, Base):
    __tablename__ = "rooms"

    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    room_type: Mapped[RoomType] = mapped_column(Enum(RoomType), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    floor: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    department = relationship("Department", back_populates="rooms")
    beds = relationship("Bed", back_populates="room", lazy="selectin")


class Bed(TenantMixin, Base):
    __tablename__ = "beds"

    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False)
    bed_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[BedStatus] = mapped_column(Enum(BedStatus), default=BedStatus.AVAILABLE)

    room = relationship("Room", back_populates="beds")


class BedAssignment(TenantMixin, Base):
    __tablename__ = "bed_assignments"

    bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
```

- [ ] **Step 17: Create backend/app/models/telemedicine.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class TelemedicineStatus(str, enum.Enum):
    WAITING = "WAITING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TelemedicineSession(TenantMixin, Base):
    __tablename__ = "telemedicine_sessions"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id"))
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"))
    room_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[TelemedicineStatus] = mapped_column(Enum(TelemedicineStatus), default=TelemedicineStatus.WAITING)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    patient_questionnaire: Mapped[dict | None] = mapped_column(JSON)
    doctor_notes: Mapped[str | None] = mapped_column(Text)


class Message(TenantMixin, Base):
    __tablename__ = "messages"

    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attachment_url: Mapped[str | None] = mapped_column(String(500))
```

- [ ] **Step 18: Create backend/app/models/face.py**

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class FaceSource(str, enum.Enum):
    CAMERA = "CAMERA"
    UPLOAD = "UPLOAD"
    PASSPORT = "PASSPORT"


class FaceSnapshot(TenantMixin, Base):
    __tablename__ = "face_snapshots"

    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[FaceSource] = mapped_column(Enum(FaceSource), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))


class FaceEmbedding(TenantMixin, Base):
    __tablename__ = "face_embeddings"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    face_snapshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("face_snapshots.id"), nullable=False)
    embedding: Mapped[list] = mapped_column(JSON, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
```

- [ ] **Step 19: Create backend/app/models/audit.py**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class AuditLog(TenantMixin, Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_values: Mapped[dict | None] = mapped_column(JSON)
    new_values: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
```

- [ ] **Step 20: Create backend/app/models/__init__.py to import all models**

```python
from app.models.base import Base
from app.models.clinic import Clinic
from app.models.user import User, Role, Permission, RolePermission
from app.models.patient import Patient, PatientGuardian
from app.models.medical import MedicalCard, Visit
from app.models.treatment import TreatmentPlan, TreatmentPlanItem
from app.models.medication import Drug, Prescription, PrescriptionItem, Inventory, Supplier, PurchaseOrder
from app.models.laboratory import LabTestCatalog, LabOrder, LabResult
from app.models.procedure import Procedure, ProcedureOrder
from app.models.exercise import Exercise, ExerciseSession, ExerciseRep
from app.models.staff import StaffSchedule, Shift, Attendance
from app.models.billing import Invoice, InvoiceItem, Payment
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.stroke import StrokeAssessment, RehabGoal, RehabProgress
from app.models.facility import Department, Room, Bed, BedAssignment
from app.models.telemedicine import TelemedicineSession, Message
from app.models.face import FaceSnapshot, FaceEmbedding
from app.models.audit import AuditLog

__all__ = [
    "Base",
    "Clinic",
    "User", "Role", "Permission", "RolePermission",
    "Patient", "PatientGuardian",
    "MedicalCard", "Visit",
    "TreatmentPlan", "TreatmentPlanItem",
    "Drug", "Prescription", "PrescriptionItem", "Inventory", "Supplier", "PurchaseOrder",
    "LabTestCatalog", "LabOrder", "LabResult",
    "Procedure", "ProcedureOrder",
    "Exercise", "ExerciseSession", "ExerciseRep",
    "StaffSchedule", "Shift", "Attendance",
    "Invoice", "InvoiceItem", "Payment",
    "Appointment",
    "Notification",
    "StrokeAssessment", "RehabGoal", "RehabProgress",
    "Department", "Room", "Bed", "BedAssignment",
    "TelemedicineSession", "Message",
    "FaceSnapshot", "FaceEmbedding",
    "AuditLog",
]
```

- [ ] **Step 21: Commit all models**

```bash
git add backend/app/models/
git commit -m "feat: all 50+ SQLAlchemy models with enums, relations, indexes"
```

---

## Task 4: Alembic Setup & Initial Migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`

- [ ] **Step 1: Create backend/alembic.ini**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create backend/alembic directory and env.py**

Create `backend/alembic/versions/` directory (empty, with `.gitkeep`).

Create `backend/alembic/env.py`:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Create `backend/alembic/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 3: Generate initial migration (run inside Docker after stack is up)**

```bash
cd backend && alembic revision --autogenerate -m "initial schema - all tables"
```

- [ ] **Step 4: Apply migration**

```bash
cd backend && alembic upgrade head
```

- [ ] **Step 5: Commit Alembic setup**

```bash
git add backend/alembic/ backend/alembic.ini
git commit -m "feat: Alembic setup with initial migration for all tables"
```

---

## Task 5: Security — JWT + Password Hashing

**Files:**
- Create: `backend/app/core/security.py`

- [ ] **Step 1: Create backend/app/core/security.py**

```python
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: str,
    role: str,
    clinic_id: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "clinic_id": clinic_id,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    role: str,
    clinic_id: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "clinic_id": clinic_id,
        "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/security.py
git commit -m "feat: JWT token creation/decoding and bcrypt password hashing"
```

---

## Task 6: Pydantic Schemas — Auth, User, Clinic, Common

**Files:**
- Create: `backend/app/schemas/common.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/user.py`
- Create: `backend/app/schemas/clinic.py`

- [ ] **Step 1: Create backend/app/schemas/common.py**

```python
import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = {}


class ErrorResponse(BaseModel):
    error: ErrorDetail


class CursorParams(BaseModel):
    cursor: str | None = None
    limit: int = 20


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False
    total: int = 0


class BaseOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Create backend/app/schemas/auth.py**

```python
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
```

- [ ] **Step 3: Create backend/app/schemas/user.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    phone: str | None = None
    role: UserRole
    specialization: str | None = None
    department_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    phone: str | None = None
    specialization: str | None = None
    department_id: uuid.UUID | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    phone: str | None = None
    role: UserRole
    avatar_url: str | None = None
    specialization: str | None = None
    department_id: uuid.UUID | None = None
    clinic_id: uuid.UUID | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Create backend/app/schemas/clinic.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.clinic import SubscriptionPlan


class ClinicCreate(BaseModel):
    name: str
    slug: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None


class ClinicUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None
    is_active: bool | None = None
    settings: dict | None = None


class ClinicOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None
    subscription_plan: SubscriptionPlan
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Commit schemas**

```bash
git add backend/app/schemas/
git commit -m "feat: Pydantic schemas for auth, user, clinic, common"
```

---

## Task 7: Repository Layer — Base + User + Clinic

**Files:**
- Create: `backend/app/repositories/base.py`
- Create: `backend/app/repositories/user.py`
- Create: `backend/app/repositories/clinic.py`

- [ ] **Step 1: Create backend/app/repositories/base.py**

```python
import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get_by_id(self, id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> ModelType | None:
        query = select(self.model).where(
            self.model.id == id,
            self.model.is_deleted == False,
        )
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        clinic_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 20,
        filters: dict[str, Any] | None = None,
        order_by: str = "created_at",
        order_desc: bool = True,
    ) -> list[ModelType]:
        query = select(self.model).where(self.model.is_deleted == False)
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.where(getattr(self.model, key) == value)
        if hasattr(self.model, order_by):
            col = getattr(self.model, order_by)
            query = query.order_by(col.desc() if order_desc else col.asc())
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, obj_data: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_data)
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def update(self, id: uuid.UUID, obj_data: dict[str, Any], clinic_id: uuid.UUID | None = None) -> ModelType | None:
        db_obj = await self.get_by_id(id, clinic_id)
        if db_obj is None:
            return None
        for key, value in obj_data.items():
            if value is not None:
                setattr(db_obj, key, value)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def soft_delete(self, id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> bool:
        db_obj = await self.get_by_id(id, clinic_id)
        if db_obj is None:
            return False
        db_obj.is_deleted = True
        await self.session.flush()
        return True

    async def count(self, clinic_id: uuid.UUID | None = None, filters: dict[str, Any] | None = None) -> int:
        query = select(func.count()).select_from(self.model).where(self.model.is_deleted == False)
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.where(getattr(self.model, key) == value)
        result = await self.session.execute(query)
        return result.scalar_one()
```

- [ ] **Step 2: Create backend/app/repositories/user.py**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email, User.is_deleted == False)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
```

- [ ] **Step 3: Create backend/app/repositories/clinic.py**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinic import Clinic
from app.repositories.base import BaseRepository


class ClinicRepository(BaseRepository[Clinic]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Clinic, session)

    async def get_by_slug(self, slug: str) -> Clinic | None:
        query = select(Clinic).where(Clinic.slug == slug, Clinic.is_deleted == False)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
```

- [ ] **Step 4: Commit repositories**

```bash
git add backend/app/repositories/
git commit -m "feat: repository layer - base CRUD, user, clinic"
```

---

## Task 8: Service Layer — Auth, User, Clinic

**Files:**
- Create: `backend/app/services/auth.py`
- Create: `backend/app/services/user.py`
- Create: `backend/app/services/clinic.py`

- [ ] **Step 1: Create backend/app/services/auth.py**

```python
import uuid
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import TokenResponse


class AuthService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self.user_repo = UserRepository(session)
        self.redis = redis
        self.session = session

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self.user_repo.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is deactivated")

        clinic_id = str(user.clinic_id) if user.clinic_id else None
        access_token = create_access_token(str(user.id), user.role.value, clinic_id)
        refresh_token = create_refresh_token(str(user.id), user.role.value, clinic_id)

        user.last_login_at = datetime.now(timezone.utc)
        await self.session.flush()

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise AuthenticationError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        jti = payload.get("jti")
        is_blacklisted = await self.redis.get(f"blacklist:{jti}")
        if is_blacklisted:
            raise AuthenticationError("Token has been revoked")

        user_id = payload.get("sub")
        user = await self.user_repo.get_by_id(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise AuthenticationError("User not found or deactivated")

        # Blacklist old refresh token
        ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await self.redis.setex(f"blacklist:{jti}", ttl, "1")

        clinic_id = str(user.clinic_id) if user.clinic_id else None
        new_access = create_access_token(str(user.id), user.role.value, clinic_id)
        new_refresh = create_refresh_token(str(user.id), user.role.value, clinic_id)

        return TokenResponse(access_token=new_access, refresh_token=new_refresh)

    async def logout(self, access_token: str, refresh_token: str | None = None) -> None:
        try:
            payload = decode_token(access_token)
            jti = payload.get("jti")
            ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
            if ttl > 0:
                await self.redis.setex(f"blacklist:{jti}", ttl, "1")
        except ValueError:
            pass

        if refresh_token:
            try:
                payload = decode_token(refresh_token)
                jti = payload.get("jti")
                ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
                if ttl > 0:
                    await self.redis.setex(f"blacklist:{jti}", ttl, "1")
            except ValueError:
                pass

    async def get_current_user(self, user_id: str) -> User:
        user = await self.user_repo.get_by_id(uuid.UUID(user_id))
        if user is None:
            raise NotFoundError("User", user_id)
        return user
```

- [ ] **Step 2: Create backend/app/services/user.py**

```python
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)

    async def create_user(self, data: UserCreate, clinic_id: uuid.UUID) -> User:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictError(f"User with email {data.email} already exists")

        user_data = data.model_dump(exclude={"password"})
        user_data["hashed_password"] = hash_password(data.password)
        user_data["clinic_id"] = clinic_id
        return await self.repo.create(user_data)

    async def get_user(self, user_id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> User:
        user = await self.repo.get_by_id(user_id, clinic_id)
        if user is None:
            raise NotFoundError("User", str(user_id))
        return user

    async def list_users(
        self, clinic_id: uuid.UUID, skip: int = 0, limit: int = 20, role: str | None = None
    ) -> list[User]:
        filters = {}
        if role:
            filters["role"] = role
        return await self.repo.get_multi(clinic_id=clinic_id, skip=skip, limit=limit, filters=filters)

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate, clinic_id: uuid.UUID | None = None) -> User:
        user = await self.repo.update(user_id, data.model_dump(exclude_unset=True), clinic_id)
        if user is None:
            raise NotFoundError("User", str(user_id))
        return user

    async def delete_user(self, user_id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> None:
        deleted = await self.repo.soft_delete(user_id, clinic_id)
        if not deleted:
            raise NotFoundError("User", str(user_id))

    async def count_users(self, clinic_id: uuid.UUID) -> int:
        return await self.repo.count(clinic_id=clinic_id)
```

- [ ] **Step 3: Create backend/app/services/clinic.py**

```python
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.clinic import Clinic
from app.repositories.clinic import ClinicRepository
from app.schemas.clinic import ClinicCreate, ClinicUpdate


class ClinicService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ClinicRepository(session)

    async def create_clinic(self, data: ClinicCreate) -> Clinic:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictError(f"Clinic with slug '{data.slug}' already exists")
        return await self.repo.create(data.model_dump())

    async def get_clinic(self, clinic_id: uuid.UUID) -> Clinic:
        clinic = await self.repo.get_by_id(clinic_id)
        if clinic is None:
            raise NotFoundError("Clinic", str(clinic_id))
        return clinic

    async def list_clinics(self, skip: int = 0, limit: int = 20) -> list[Clinic]:
        return await self.repo.get_multi(skip=skip, limit=limit)

    async def update_clinic(self, clinic_id: uuid.UUID, data: ClinicUpdate) -> Clinic:
        clinic = await self.repo.update(clinic_id, data.model_dump(exclude_unset=True))
        if clinic is None:
            raise NotFoundError("Clinic", str(clinic_id))
        return clinic

    async def delete_clinic(self, clinic_id: uuid.UUID) -> None:
        deleted = await self.repo.soft_delete(clinic_id)
        if not deleted:
            raise NotFoundError("Clinic", str(clinic_id))
```

- [ ] **Step 4: Commit services**

```bash
git add backend/app/services/
git commit -m "feat: service layer - auth, user, clinic with business logic"
```

---

## Task 9: API Dependencies & Middleware

**Files:**
- Create: `backend/app/api/deps.py`
- Create: `backend/app/core/middleware.py`

- [ ] **Step 1: Create backend/app/api/deps.py**

```python
import uuid
from typing import Annotated

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import AuthenticationError, ForbiddenError
from app.core.redis import get_redis
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

security_scheme = HTTPBearer()

DBSession = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    session: DBSession,
    redis: RedisClient,
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise AuthenticationError("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")

    jti = payload.get("jti")
    is_blacklisted = await redis.get(f"blacklist:{jti}")
    if is_blacklisted:
        raise AuthenticationError("Token has been revoked")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload")

    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or deactivated")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    async def role_checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(f"Role {current_user.role.value} does not have access to this resource")
        return current_user
    return Depends(role_checker)
```

- [ ] **Step 2: Create backend/app/core/middleware.py**

```python
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

        await logger.ainfo(
            "request",
            request_id=request_id,
            method=request.method,
            path=str(request.url.path),
            status_code=response.status_code,
            duration_ms=duration_ms,
            client_ip=request.client.host if request.client else None,
        )

        response.headers["X-Request-ID"] = request_id
        return response
```

- [ ] **Step 3: Commit deps and middleware**

```bash
git add backend/app/api/deps.py backend/app/core/middleware.py
git commit -m "feat: API dependencies (auth, role guards) and request logging middleware"
```

---

## Task 10: API Routes — Health, Auth, Users, Clinics

**Files:**
- Create: `backend/app/api/v1/routes/health.py`
- Create: `backend/app/api/v1/routes/auth.py`
- Create: `backend/app/api/v1/routes/users.py`
- Create: `backend/app/api/v1/routes/clinics.py`
- Create: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create backend/app/api/v1/routes/health.py**

```python
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.redis import get_redis

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health_check():
    return {"status": "ok"}


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
```

- [ ] **Step 2: Create backend/app/api/v1/routes/auth.py**

```python
from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession, RedisClient
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserOut
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: DBSession, redis: RedisClient):
    service = AuthService(session, redis)
    return await service.login(data.email, data.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, session: DBSession, redis: RedisClient):
    service = AuthService(session, redis)
    return await service.refresh(data.refresh_token)


@router.post("/logout")
async def logout(request: Request, current_user: CurrentUser, redis: RedisClient):
    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.replace("Bearer ", "") if auth_header else ""
    service = AuthService(request.state._state.get("session", None), redis)  # noqa
    # Blacklist the access token
    from app.core.security import decode_token
    try:
        payload = decode_token(access_token)
        jti = payload.get("jti")
        from datetime import datetime, timezone
        ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await redis.setex(f"blacklist:{jti}", ttl, "1")
    except ValueError:
        pass
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return current_user
```

- [ ] **Step 3: Create backend/app/api/v1/routes/users.py**

```python
import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    session: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: UserRole | None = None,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = UserService(session)
    return await service.list_users(current_user.clinic_id, skip, limit, role.value if role else None)


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    data: UserCreate,
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = UserService(session)
    return await service.create_user(data, current_user.clinic_id)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = UserService(session)
    return await service.get_user(user_id, current_user.clinic_id)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = UserService(session)
    return await service.update_user(user_id, data, current_user.clinic_id)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = UserService(session)
    await service.delete_user(user_id, current_user.clinic_id)
```

- [ ] **Step 4: Create backend/app/api/v1/routes/clinics.py**

```python
import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.clinic import ClinicCreate, ClinicOut, ClinicUpdate
from app.services.clinic import ClinicService

router = APIRouter(prefix="/clinics", tags=["Clinics"])


@router.get("", response_model=list[ClinicOut])
async def list_clinics(
    session: DBSession,
    _admin=require_role(UserRole.SUPER_ADMIN),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    service = ClinicService(session)
    return await service.list_clinics(skip, limit)


@router.post("", response_model=ClinicOut, status_code=201)
async def create_clinic(
    data: ClinicCreate,
    session: DBSession,
    _admin=require_role(UserRole.SUPER_ADMIN),
):
    service = ClinicService(session)
    return await service.create_clinic(data)


@router.get("/{clinic_id}", response_model=ClinicOut)
async def get_clinic(
    clinic_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = ClinicService(session)
    return await service.get_clinic(clinic_id)


@router.patch("/{clinic_id}", response_model=ClinicOut)
async def update_clinic(
    clinic_id: uuid.UUID,
    data: ClinicUpdate,
    session: DBSession,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = ClinicService(session)
    return await service.update_clinic(clinic_id, data)


@router.delete("/{clinic_id}", status_code=204)
async def delete_clinic(
    clinic_id: uuid.UUID,
    session: DBSession,
    _admin=require_role(UserRole.SUPER_ADMIN),
):
    service = ClinicService(session)
    await service.delete_clinic(clinic_id)
```

- [ ] **Step 5: Create backend/app/api/v1/router.py**

```python
from fastapi import APIRouter

from app.api.v1.routes import auth, clinics, health, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(clinics.router)
```

- [ ] **Step 6: Commit routes**

```bash
git add backend/app/api/
git commit -m "feat: API routes - health checks, auth, users, clinics CRUD"
```

---

## Task 11: FastAPI Main App + Celery

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/tasks/celery_app.py`

- [ ] **Step 1: Create backend/app/main.py**

```python
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


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

app.add_exception_handler(APIError, api_error_handler)

app.include_router(api_router)
```

- [ ] **Step 2: Create backend/app/tasks/celery_app.py**

```python
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "medcore",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Bishkek",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {}
```

- [ ] **Step 3: Commit main app**

```bash
git add backend/app/main.py backend/app/tasks/
git commit -m "feat: FastAPI main app with CORS, logging, exceptions + Celery config"
```

---

## Task 12: Seed Script

**Files:**
- Create: `backend/seed.py`

- [ ] **Step 1: Create backend/seed.py**

```python
import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine
from app.core.security import hash_password
from app.models import Base
from app.models.clinic import Clinic, SubscriptionPlan
from app.models.facility import Bed, BedStatus, Department, Room, RoomType
from app.models.patient import BloodType, Gender, Patient, PatientStatus, RegistrationSource
from app.models.medical import MedicalCard
from app.models.user import User, UserRole


async def seed():
    async with engine.begin() as conn:
        pass  # Tables created by Alembic

    async with async_session_factory() as session:
        # Check if already seeded
        from sqlalchemy import select
        existing = await session.execute(select(Clinic).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        clinic_id = uuid.uuid4()
        clinic = Clinic(
            id=clinic_id,
            name="Бишкек Мед Центр",
            slug="bishkek-med",
            address="ул. Токтогула 123, Бишкек, Кыргызстан",
            phone="+996 312 123456",
            email="info@bishkek-med.kg",
            working_hours={
                "mon": ["08:00", "18:00"],
                "tue": ["08:00", "18:00"],
                "wed": ["08:00", "18:00"],
                "thu": ["08:00", "18:00"],
                "fri": ["08:00", "18:00"],
                "sat": ["09:00", "14:00"],
                "sun": None,
            },
            subscription_plan=SubscriptionPlan.PRO,
            is_active=True,
            clinic_id=clinic_id,
        )
        session.add(clinic)

        # Super Admin (no clinic binding)
        super_admin = User(
            id=uuid.uuid4(),
            email="admin@medcore.kg",
            hashed_password=hash_password("Admin123!"),
            first_name="System",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            clinic_id=clinic_id,
        )
        session.add(super_admin)

        # Departments
        dept_therapy = Department(id=uuid.uuid4(), name="Терапия", code="THER", clinic_id=clinic_id)
        dept_neuro = Department(id=uuid.uuid4(), name="Неврология", code="NEUR", clinic_id=clinic_id)
        dept_emergency = Department(id=uuid.uuid4(), name="Скорая помощь", code="EMER", clinic_id=clinic_id)
        dept_pharmacy = Department(id=uuid.uuid4(), name="Аптека", code="PHAR", clinic_id=clinic_id)
        dept_lab = Department(id=uuid.uuid4(), name="Лаборатория", code="LAB", clinic_id=clinic_id)
        for dept in [dept_therapy, dept_neuro, dept_emergency, dept_pharmacy, dept_lab]:
            session.add(dept)

        # Staff
        staff_data = [
            ("clinic_admin@bishkek-med.kg", "Айгуль", "Маматова", UserRole.CLINIC_ADMIN, None, None),
            ("doctor.therapist@bishkek-med.kg", "Бакыт", "Исаков", UserRole.DOCTOR, "Терапевт", dept_therapy.id),
            ("doctor.neuro@bishkek-med.kg", "Нурлан", "Жумабеков", UserRole.DOCTOR, "Невролог", dept_neuro.id),
            ("nurse@bishkek-med.kg", "Гулзат", "Токтобаева", UserRole.NURSE, None, dept_therapy.id),
            ("reception@bishkek-med.kg", "Жаныл", "Асанова", UserRole.RECEPTIONIST, None, None),
            ("pharmacist@bishkek-med.kg", "Эрмек", "Кадыров", UserRole.PHARMACIST, None, dept_pharmacy.id),
            ("lab@bishkek-med.kg", "Азамат", "Турдубаев", UserRole.LAB_TECHNICIAN, None, dept_lab.id),
        ]
        doctor_therapist_id = uuid.uuid4()
        nurse_id = uuid.uuid4()
        staff_ids = [uuid.uuid4(), doctor_therapist_id, uuid.uuid4(), nurse_id, uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]

        for i, (email, first, last, role, spec, dept_id) in enumerate(staff_data):
            user = User(
                id=staff_ids[i],
                email=email,
                hashed_password=hash_password("Staff123!"),
                first_name=first,
                last_name=last,
                role=role,
                specialization=spec,
                department_id=dept_id,
                is_active=True,
                clinic_id=clinic_id,
            )
            session.add(user)

        # Rooms and Beds
        room_therapy = Room(
            id=uuid.uuid4(), department_id=dept_therapy.id, name="Палата 101",
            room_number="101", room_type=RoomType.WARD, capacity=4, floor=1, clinic_id=clinic_id,
        )
        room_neuro = Room(
            id=uuid.uuid4(), department_id=dept_neuro.id, name="Палата 201",
            room_number="201", room_type=RoomType.WARD, capacity=2, floor=2, clinic_id=clinic_id,
        )
        room_consult = Room(
            id=uuid.uuid4(), department_id=dept_therapy.id, name="Кабинет 1",
            room_number="K1", room_type=RoomType.CONSULTATION, capacity=1, floor=1, clinic_id=clinic_id,
        )
        for room in [room_therapy, room_neuro, room_consult]:
            session.add(room)

        for i in range(1, 5):
            bed = Bed(
                id=uuid.uuid4(), room_id=room_therapy.id, bed_number=f"101-{i}",
                status=BedStatus.AVAILABLE, clinic_id=clinic_id,
            )
            session.add(bed)
        for i in range(1, 3):
            bed = Bed(
                id=uuid.uuid4(), room_id=room_neuro.id, bed_number=f"201-{i}",
                status=BedStatus.AVAILABLE, clinic_id=clinic_id,
            )
            session.add(bed)

        # Patients
        patients_data = [
            ("Асан", "Уметов", "Бакирович", "1985-03-15", Gender.MALE, "AN1234567", "12345678901234"),
            ("Бермет", "Сыдыкова", "Канатовна", "1990-07-22", Gender.FEMALE, "AN2345678", "23456789012345"),
            ("Канат", "Жээнбеков", "Сагындыкович", "1978-11-01", Gender.MALE, "AN3456789", "34567890123456"),
            ("Динара", "Абдыкалыкова", "Нурлановна", "1995-05-10", Gender.FEMALE, "AN4567890", "45678901234567"),
            ("Эрмек", "Бообеков", "Талантович", "1960-01-30", Gender.MALE, "AN5678901", "56789012345678"),
        ]

        for i, (first, last, middle, dob, gender, passport, inn) in enumerate(patients_data):
            from datetime import date
            patient_id = uuid.uuid4()
            patient = Patient(
                id=patient_id,
                first_name=first,
                last_name=last,
                middle_name=middle,
                date_of_birth=date.fromisoformat(dob),
                gender=gender,
                passport_number=passport,
                inn=inn,
                address=f"г. Бишкек, ул. Примерная {i+1}",
                phone=f"+996 555 {100000 + i}",
                blood_type=BloodType.UNKNOWN,
                assigned_doctor_id=doctor_therapist_id,
                assigned_nurse_id=nurse_id,
                registration_source=RegistrationSource.WALK_IN,
                status=PatientStatus.ACTIVE,
                clinic_id=clinic_id,
            )
            session.add(patient)

            medical_card = MedicalCard(
                id=uuid.uuid4(),
                patient_id=patient_id,
                card_number=f"MC-bishkek-med-{1000 + i}",
                opened_at=datetime.now(timezone.utc),
                clinic_id=clinic_id,
            )
            session.add(medical_card)

        await session.commit()
        print("Seed completed successfully!")
        print("Login credentials:")
        print("  Super Admin: admin@medcore.kg / Admin123!")
        print("  Clinic Admin: clinic_admin@bishkek-med.kg / Staff123!")
        print("  Doctor: doctor.therapist@bishkek-med.kg / Staff123!")
        print("  Receptionist: reception@bishkek-med.kg / Staff123!")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Commit seed**

```bash
git add backend/seed.py
git commit -m "feat: seed script with demo clinic, staff, patients, departments"
```

---

## Task 13: Frontend Scaffolding — Vite, Tailwind, TypeScript, shadcn/ui

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/components.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/lib/utils.ts`

- [ ] **Step 1: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MedCore KG</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Create TypeScript configs**

`frontend/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`frontend/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create Tailwind + PostCSS config**

`frontend/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        foreground: "var(--color-text-primary)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-text-secondary)",
        },
        destructive: {
          DEFAULT: "var(--color-danger)",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "#ffffff",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text-primary)",
        },
        popover: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text-primary)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

`frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary: #BDEDE0;
    --color-primary-foreground: #1A1A2E;
    --color-secondary: #7E78D2;
    --color-secondary-foreground: #ffffff;
    --color-background: #F8FFFE;
    --color-surface: #FFFFFF;
    --color-text-primary: #1A1A2E;
    --color-text-secondary: #6B7280;
    --color-danger: #EF4444;
    --color-warning: #F59E0B;
    --color-success: #10B981;
    --color-muted: #F1F5F9;
    --color-border: #E2E8F0;
    --color-input: #E2E8F0;
    --color-ring: #7E78D2;
    --color-accent: #F1F5F9;
    --color-accent-foreground: #1A1A2E;
    --radius: 0.5rem;
  }

  .dark {
    --color-primary: #BDEDE0;
    --color-primary-foreground: #1A1A2E;
    --color-secondary: #7E78D2;
    --color-secondary-foreground: #ffffff;
    --color-background: #0F1117;
    --color-surface: #1A1D2E;
    --color-text-primary: #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-danger: #EF4444;
    --color-warning: #F59E0B;
    --color-success: #10B981;
    --color-muted: #1E293B;
    --color-border: #334155;
    --color-input: #334155;
    --color-ring: #7E78D2;
    --color-accent: #1E293B;
    --color-accent-foreground: #F1F5F9;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

- [ ] **Step 6: Create frontend/components.json (shadcn/ui config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Create frontend/src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd.MM.yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd.MM.yyyy HH:mm");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-KG", {
    style: "currency",
    currency: "KGS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

- [ ] **Step 8: Create frontend/src/main.tsx and frontend/src/App.tsx (initial shell)**

`frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`frontend/src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { useAuthStore } from "@/stores/auth-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: undefined!,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const auth = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth, queryClient }} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 9: Commit frontend scaffolding**

```bash
git add frontend/
git commit -m "feat: frontend scaffolding - Vite, Tailwind, TypeScript, shadcn/ui config"
```

---

## Task 14: Frontend — Types, API Client, Auth Store

**Files:**
- Create: `frontend/src/types/api.ts`
- Create: `frontend/src/types/auth.ts`
- Create: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/lib/query-client.ts`
- Create: `frontend/src/stores/auth-store.ts`

- [ ] **Step 1: Create frontend/src/types/api.ts**

```typescript
export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

export class APIError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

- [ ] **Step 2: Create frontend/src/types/auth.ts**

```typescript
export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "PHARMACIST"
  | "RECEPTIONIST"
  | "LAB_TECHNICIAN"
  | "PATIENT"
  | "GUARDIAN";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  specialization: string | null;
  department_id: string | null;
  clinic_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
```

- [ ] **Step 3: Create frontend/src/lib/api-client.ts**

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { APIError, APIErrorResponse } from "@/types/api";

const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<APIErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post("/api/v1/auth/refresh", {
          refresh_token: refreshToken,
        });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        processQueue(null, data.access_token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      throw new APIError(error.response.status, code, message, details);
    }

    throw new APIError(
      error.response?.status ?? 500,
      "NETWORK_ERROR",
      error.message || "An unexpected error occurred"
    );
  }
);

export default apiClient;
```

- [ ] **Step 4: Create frontend/src/lib/query-client.ts**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 5: Create frontend/src/stores/auth-store.ts**

```typescript
import { create } from "zustand";
import { User } from "@/types/auth";
import apiClient from "@/lib/api-client";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,

  login: async (email: string, password: string) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
    });
    await get().fetchUser();
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const { data } = await apiClient.get("/auth/me");
      set({ user: data, isLoading: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      get().fetchUser();
    }
  },
}));
```

- [ ] **Step 6: Commit types, API client, auth store**

```bash
git add frontend/src/types/ frontend/src/lib/ frontend/src/stores/
git commit -m "feat: frontend types, API client with refresh interceptor, Zustand auth store"
```

---

## Task 15: Frontend — Routes & Login Page

**Files:**
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/login.tsx`
- Create: `frontend/src/routes/_authenticated.tsx`
- Create: `frontend/src/routes/_authenticated/dashboard.tsx`
- Create: `frontend/src/features/auth/components/login-form.tsx`
- Create: `frontend/src/features/auth/api.ts`
- Create: `frontend/src/components/shared/loading-skeleton.tsx`
- Create: `frontend/src/components/shared/page-header.tsx`
- Create: `frontend/src/components/shared/require-role.tsx`

- [ ] **Step 1: Create frontend/src/routes/__root.tsx**

```tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import type { AuthState } from "@/stores/auth-store";

interface RouterContext {
  queryClient: QueryClient;
  auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  ),
});
```

- [ ] **Step 2: Create frontend/src/routes/login.tsx**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <svg
              className="w-8 h-8 text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">MedCore KG</h1>
          <p className="text-muted-foreground mt-1">
            Система управления клиникой
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/features/auth/components/login-form.tsx**

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { APIError } from "@/types/api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      if (error instanceof APIError) {
        toast.error(error.message);
      } else {
        toast.error("Ошибка подключения к серверу");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="doctor@clinic.kg"
          required
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 px-4 rounded-lg bg-secondary text-white font-medium hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create frontend/src/routes/_authenticated.tsx**

```tsx
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isAuthenticated, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">MedCore KG</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-muted-foreground">
                {user.first_name} {user.last_name}
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary">
                  {user.role}
                </span>
              </span>
            )}
            <button
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create frontend/src/routes/_authenticated/dashboard.tsx**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Добро пожаловать{user ? `, ${user.first_name}` : ""}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Пациенты сегодня", value: "—", color: "bg-primary/10 text-primary" },
          { label: "Активные приёмы", value: "—", color: "bg-secondary/10 text-secondary" },
          { label: "Загрузка коек", value: "—", color: "bg-success/10 text-success" },
          { label: "Выручка сегодня", value: "—", color: "bg-warning/10 text-warning" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-surface rounded-xl border border-border p-5"
          >
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <div className={`mt-3 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
              Phase 2
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create shared components**

`frontend/src/components/shared/loading-skeleton.tsx`:
```tsx
export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

`frontend/src/components/shared/page-header.tsx`:
```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
```

`frontend/src/components/shared/require-role.tsx`:
```tsx
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/auth";

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
```

- [ ] **Step 7: Create frontend/src/features/auth/api.ts**

```typescript
import apiClient from "@/lib/api-client";
import type { LoginRequest, TokenResponse, User } from "@/types/auth";

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/login", data);
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },
};
```

- [ ] **Step 8: Commit routes and login page**

```bash
git add frontend/src/
git commit -m "feat: TanStack Router routes, login page, auth layout, dashboard shell"
```

---

## Task 16: Install Frontend Dependencies & Generate Route Tree

**Files:**
- Modify: `frontend/package.json` (npm install)

- [ ] **Step 1: Install npm dependencies**

```bash
cd frontend && npm install
```

- [ ] **Step 2: Generate TanStack Router route tree**

```bash
cd frontend && npx @tanstack/router-cli generate
```

This creates `frontend/src/routeTree.gen.ts` automatically.

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit generated files**

```bash
git add frontend/src/routeTree.gen.ts frontend/package-lock.json
git commit -m "feat: install dependencies and generate TanStack Router route tree"
```

---

## Task 17: Docker Stack Validation

- [ ] **Step 1: Build and start all services**

```bash
docker-compose up --build -d
```

- [ ] **Step 2: Wait for health checks, then verify**

```bash
# Backend health
curl http://localhost:8000/api/v1/health

# DB health
curl http://localhost:8000/api/v1/health/db

# Redis health
curl http://localhost:8000/api/v1/health/redis

# OpenAPI docs
curl -s http://localhost:8000/openapi.json | head -c 200
```

Expected: All return `{"status": "ok"}` or equivalent.

- [ ] **Step 3: Run Alembic migration inside container**

```bash
docker-compose exec backend alembic revision --autogenerate -m "initial schema"
docker-compose exec backend alembic upgrade head
```

- [ ] **Step 4: Run seed script**

```bash
docker-compose exec backend python seed.py
```

Expected: "Seed completed successfully!" with login credentials printed.

- [ ] **Step 5: Test auth flow**

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@medcore.kg", "password": "Admin123!"}'

# Should return {"access_token": "...", "refresh_token": "...", "token_type": "bearer"}

# Use token to get /me
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token_from_above>"
```

- [ ] **Step 6: Verify frontend loads**

Open `http://localhost:5173` in browser — should see the MedCore KG login page.

- [ ] **Step 7: Commit Alembic migration**

```bash
git add backend/alembic/versions/
git commit -m "feat: initial Alembic migration - all 50+ tables"
```

---

## Summary

| Task | What it builds | Estimated steps |
|------|---------------|-----------------|
| 1 | Docker, nginx, env, Dockerfiles | 10 |
| 2 | Backend core: config, DB, Redis, exceptions, logging | 7 |
| 3 | All 50+ SQLAlchemy models | 21 |
| 4 | Alembic setup + migration | 5 |
| 5 | JWT + bcrypt security | 2 |
| 6 | Pydantic schemas | 5 |
| 7 | Repository layer | 4 |
| 8 | Service layer | 4 |
| 9 | API deps + middleware | 3 |
| 10 | API routes (health, auth, users, clinics) | 6 |
| 11 | FastAPI main + Celery | 3 |
| 12 | Seed script | 2 |
| 13 | Frontend scaffolding (Vite, Tailwind, shadcn) | 9 |
| 14 | Types, API client, auth store | 6 |
| 15 | Routes, login page, auth layout, dashboard | 8 |
| 16 | npm install + route generation | 4 |
| 17 | Docker stack validation | 7 |

**Total: 17 tasks, ~106 steps**

After all tasks complete: `docker-compose up --build` brings up the full stack with working auth, 50+ DB tables, seed data, and a login page.
