---
aliases: [Backend, Серверная часть]
tags: [backend, fastapi, architecture]
created: 2026-04-20
---

# Backend Overview

## Архитектура

FastAPI приложение с layered architecture:

```
Routes (API) → Services (Logic) → Repositories (Data) → Models (DB)
```

**Entry point:** `backend/app/main.py`

## Модули маршрутов (33 файла)

### Ядро системы
| Файл | Путь API | Описание |
|------|----------|----------|
| `auth.py` | `/api/v1/auth/` | JWT авторизация, login, refresh |
| `health.py` | `/api/v1/health/` | Healthcheck |
| `users.py` | `/api/v1/users/` | CRUD пользователей |
| `clinics.py` | `/api/v1/clinics/` | Управление клиниками |
| `settings.py` | `/api/v1/settings/` | Настройки приложения |
| `audit.py` | `/api/v1/audit/` | Аудит-логи |
| `notifications.py` | `/api/v1/notifications/` | Уведомления |

### Пациенты и медицина
| Файл | Описание |
|------|----------|
| `patients.py` | CRUD пациентов (35KB) |
| `registration.py` | Регистрация с OCR/Face Detection |
| `medical_history.py` | История болезни |
| `diagnoses.py` | Диагнозы (ICD-10) |
| `icd10.py` | Каталог МКБ-10 |
| `treatment.py` | Планы лечения |
| `rooms.py` | Палаты и койки |

### Специализированные модули
| Файл | Описание |
|------|----------|
| `stroke.py` | Инсульт-реабилитация |
| `recovery.py` | Цели восстановления |
| `pharmacy.py` | Аптека |
| `laboratory.py` | Лаборатория |
| `billing.py` | Биллинг |
| `schedule.py` | Расписание |
| `telemedicine.py` | Видеоконсультации |
| `analytics.py` | Аналитика |
| `staff.py` | Управление персоналом |

### Инфраструктура и AI
| Файл | Описание |
|------|----------|
| `monitoring.py` | Мониторинг датчиков |
| `infrastructure.py` | BMS (22.6KB) |
| `ai.py` | AI интеграции |
| `patient_ai.py` | AI ассистент пациента (32KB) |
| `portal.py` | Портал пациента (24.8KB) |
| `portal_voice.py` | Голосовое управление |

## Ключевые сервисы

| Сервис | Размер | Описание |
|--------|--------|----------|
| `portal.py` | 42KB | Портал пациента — самый большой сервис |
| `pharmacy.py` | 41KB | Аптека: лекарства, рецепты, склад |
| `bms.py` | 34KB | Управление зданием |
| `treatment.py` | 22KB | Планы лечения |
| `stroke.py` | 21KB | Реабилитация после инсульта |
| `rbac.py` | 19KB | Динамические роли и права |
| `patient.py` | 18KB | Бизнес-логика пациентов |
| `monitoring.py` | 17KB | Мониторинг датчиков |
| `settings.py` | 16KB | Настройки приложения |
| `billing.py` | 16KB | Финансы |
| `laboratory.py` | 15KB | Лабораторные исследования |

## Core модули

Расположены в `backend/app/core/`:

- **config.py** — Pydantic Settings (все ENV переменные)
- **database.py** — AsyncSession, engine, get_db dependency
- **security.py** — `create_access_token()`, `verify_password()`, `get_password_hash()`
- **redis.py** — Redis для сессий и кэша
- **email.py** — Отправка email через SMTP
- **middleware.py** — Request logging middleware
- **exceptions.py** — HTTPException handlers
- **logging_config.py** — Structlog конфигурация

## Связанные документы

- [[API Endpoints]]
- [[Модели базы данных]]
- [[Сервисы]]
- [[Аутентификация и RBAC]]
