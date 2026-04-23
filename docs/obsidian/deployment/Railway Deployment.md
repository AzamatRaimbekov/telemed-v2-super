---
aliases: [Railway, Деплой, Cloud]
tags: [deployment, railway, cloud]
created: 2026-04-20
---

# Railway Deployment

## Проект

- **Название:** telemed-v2
- **Скрипт:** `setup-railway.sh`

## Конфигурация

Детали конфигурации (service IDs, домены) хранятся в памяти Claude:
`reference_railway_deploy.md`

## Процесс деплоя

1. Push в `main` → Railway автоматически деплоит
2. Или вручную через `setup-railway.sh`
3. Backend стартует → миграции → seeds

## Сервисы на Railway

- **Backend** — FastAPI (Gunicorn + Uvicorn)
- **Frontend** — Static build (Nginx)
- **PostgreSQL** — Managed database
- **Redis** — Managed cache

## railway.json

Конфигурационный файл Railway в корне проекта:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "cd backend && alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/v1/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Скрипты

- `backend/scripts/healthcheck.sh` — проверка здоровья сервиса
- `backend/scripts/migrate-and-start.sh` — миграции + seeds + запуск сервера

## Связанные документы

- [[Docker и Docker Compose]]
- [[Переменные окружения]]
- [[CI-CD Pipeline]] — CI перед деплоем
