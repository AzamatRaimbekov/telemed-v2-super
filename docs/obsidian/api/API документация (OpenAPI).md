---
aliases: [API Docs, OpenAPI, Swagger, Документация API]
tags: [api, documentation, openapi]
created: 2026-04-23
---

# API документация (OpenAPI)

> Русскоязычные описания для Swagger/OpenAPI документации.

## Расположение

- Файл описаний: `backend/app/api/v1/api_docs.py`
- Swagger UI: `/docs`
- OpenAPI JSON: `/openapi.json`

## Содержание

### API_TAGS

41 тег с русскими описаниями для группировки эндпоинтов:

| Тег | Описание |
|-----|----------|
| Auth | Аутентификация |
| Patients | Управление пациентами |
| Staff | Управление персоналом |
| Schedule | Расписание приёмов |
| Appointments | Управление приёмами |
| Laboratory | Лабораторные исследования |
| Pharmacy | Аптека |
| Billing | Биллинг |
| Monitoring | IoT мониторинг |
| Infrastructure | BMS |
| Telemedicine | Видеоконсультации |
| Portal | Портал пациента |
| AI | AI функции |
| ... | и ещё 28 тегов |

### API_DESCRIPTION

Markdown-описание API с разделами:
- Общее описание платформы
- Инструкция по аутентификации (JWT Bearer)
- Версионирование API

## Интеграция

В `backend/app/main.py` добавить:

```python
from app.api.v1.api_docs import API_TAGS, API_DESCRIPTION

app = FastAPI(
    ...,
    openapi_tags=API_TAGS,
    description=API_DESCRIPTION,
)
```

## Связанные модули

- [[API Endpoints]] — все маршруты
- [[Backend Overview]] — архитектура бэкенда
- [[Аутентификация и RBAC]] — JWT и роли
