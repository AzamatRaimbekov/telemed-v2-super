---
aliases: [Redis Cache, Кэш]
tags: [feature, backend, performance]
created: 2026-04-23
---

# Redis кэширование

> Сервис кэширования часто запрашиваемых данных через Redis. Снижает нагрузку на PostgreSQL и ускоряет ответы API.

---

## Архитектура

**CacheService** (`backend/app/services/cache_service.py`):
- Использует общий `redis_pool` из `app.core.redis`
- Префикс ключей: `medcore:`
- TTL по умолчанию: 300 секунд (5 минут)
- Все ошибки Redis перехватываются — кэш не блокирует работу приложения

---

## API

### Основные методы

```python
from app.services.cache_service import CacheService

# Получить значение
data = await CacheService.get("patients:123")

# Записать с TTL
await CacheService.set("patients:123", patient_dict, ttl=600)

# Удалить ключ
await CacheService.delete("patients:123")

# Удалить по паттерну
await CacheService.invalidate_pattern("patients:*")

# Get-or-set (cache-aside)
data = await CacheService.get_or_set(
    "dashboard:stats",
    factory=lambda: compute_stats(),
    ttl=120
)
```

---

## Стратегия инвалидации

| Событие | Действие |
|---------|---------|
| Обновление пациента | `delete("patients:{id}")` |
| Новая запись | `invalidate_pattern("schedule:*")` |
| Изменение справочника | `invalidate_pattern("ref:*")` |

---

## Файлы

- `backend/app/services/cache_service.py` — CacheService
- `backend/app/core/redis.py` — Redis connection pool
