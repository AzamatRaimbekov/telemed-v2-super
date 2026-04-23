---
aliases: [Docker, Docker Compose, Контейнеры]
tags: [deployment, docker]
created: 2026-04-20
---

# Docker и Docker Compose

## Сервисы (docker-compose.yml)

| Сервис | Образ | Порт | Описание |
|--------|-------|------|----------|
| **postgres** | postgres:16-alpine | 5432 | Основная БД |
| **redis** | redis:7-alpine | 6379 | Кэш, сессии, Celery |
| **minio** | minio/minio | 9000, 9001 | S3 файловое хранилище |
| **backend** | Dockerfile | 8000 | FastAPI сервер |
| **frontend** | Dockerfile | 5173 | React (Vite dev / Nginx prod) |
| **nginx** | nginx:alpine | 80 | Reverse proxy |
| **celery-worker** | backend image | — | Фоновые задачи |
| **celery-beat** | backend image | — | Планировщик задач |

## Конфигурационные файлы

- `docker-compose.yml` — основная конфигурация (dev)
- `docker-compose.prod.yml` — продакшен оверрайды
- `backend/Dockerfile` — сборка backend
- `frontend/Dockerfile` — сборка frontend
- `nginx/nginx.conf` — конфигурация прокси
- `frontend/nginx.conf` — nginx для SPA

## Запуск

```bash
# Разработка
docker-compose up -d

# Продакшен
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Автозапуск при старте

Backend `main.py` (lifespan):
1. Alembic миграции
2. `seed_prod_all.py`
3. `seed_catalogs.py`
4. `seed_exercises.py`
5. `seed_rooms.py`
6. `seed_rbac.py`
7. `seed_monitoring.py`
8. `seed_pharmacy.py`
9. `seed_bms.py`

Все seed скрипты **идемпотентны** — безопасны для повторного запуска.

## Связанные документы

- [[Railway Deployment]]
- [[Переменные окружения]]
- [[Seed скрипты]]
