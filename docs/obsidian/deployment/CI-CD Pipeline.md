---
aliases: [CI/CD, GitHub Actions, Pipeline]
tags: [deployment, ci-cd, github-actions]
created: 2026-04-23
---

# CI/CD Pipeline (GitHub Actions)

## Обзор

CI pipeline запускается автоматически при push в `main` и при создании pull request в `main`.

Файл конфигурации: `.github/workflows/ci.yml`

## Jobs

### 1. backend-tests

Запуск pytest с PostgreSQL и Redis сервисами.

**Сервисы:**
- PostgreSQL 16 Alpine (`medcore_test` / `test` / `test`)
- Redis 7 Alpine

**Шаги:**
1. Checkout кода
2. Setup Python 3.12
3. `pip install -r requirements.txt`
4. `pytest tests/ -v --tb=short`

**Env переменные для тестов:**
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=medcore_test
POSTGRES_USER=test
POSTGRES_PASSWORD=test
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET_KEY=test-secret
JWT_ALGORITHM=HS256
```

### 2. frontend-build

Проверка сборки фронтенда.

**Шаги:**
1. Checkout
2. Setup pnpm 10 + Node 20
3. `pnpm install --frozen-lockfile`
4. `npx tsc --noEmit` — проверка типов
5. `npx vite build` — сборка

### 3. lint

Линтинг фронтенд кода.

**Шаги:**
1. Checkout
2. Setup pnpm 10 + Node 20
3. `pnpm install --frozen-lockfile`
4. `pnpm lint`

## Триггеры

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

## Связанные документы

- [[Тесты]] — Какие тесты запускаются
- [[Railway Deployment]] — Деплой после CI
- [[Docker и Docker Compose]]
