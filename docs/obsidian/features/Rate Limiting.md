---
aliases: [Rate Limiter, Ограничение запросов]
tags: [feature, backend, security]
created: 2026-04-23
---

# Rate Limiting (Ограничение частоты запросов)

> Защита API от злоупотреблений через ограничение количества запросов в минуту. Использует Redis для подсчёта.

---

## Архитектура

**RateLimitMiddleware** (`backend/app/core/rate_limiter.py`):
- Starlette middleware, подключается в `main.py`
- Подсчёт запросов в Redis с TTL 60 секунд
- Идентификация по JWT токену или IP-адресу
- При недоступности Redis — запросы не блокируются

---

## Конфигурация

```python
# В main.py:
from app.core.rate_limiter import RateLimitMiddleware

app.add_middleware(RateLimitMiddleware, requests_per_minute=120)
```

### Параметры

| Параметр | По умолчанию | Описание |
|----------|-------------|---------|
| `requests_per_minute` | 60 | Макс. запросов в минуту |
| `burst` | 10 | Запас для пиковых нагрузок |

---

## Исключения

Middleware пропускает без проверки:
- WebSocket пути (`/ws/...`)
- Health-check (`*/health`)
- Не-API пути (статика, фронтенд)

---

## Ответ при превышении лимита

```
HTTP 429 Too Many Requests
Retry-After: 60

{
  "detail": "Слишком много запросов. Попробуйте позже."
}
```

---

## Redis ключи

- Формат: `rl:{identifier}`
- `identifier` — первые 20 символов JWT или IP-адрес
- TTL: 60 секунд (автоматический сброс)

---

## Файлы

- `backend/app/core/rate_limiter.py` — RateLimitMiddleware
- `backend/app/core/redis.py` — Redis connection pool
