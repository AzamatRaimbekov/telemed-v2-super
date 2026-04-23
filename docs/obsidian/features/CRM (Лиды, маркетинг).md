---
aliases: [CRM, Лиды, Маркетинг, Leads]
tags: [feature, crm, marketing]
created: 2026-04-23
---

# CRM (Лиды, маркетинг)

## Описание

Управление лидами и маркетинговой воронкой клиники. Отслеживание источников обращений (сайт, телефон, WhatsApp, соцсети, реклама), статусов конверсии, назначение ответственных менеджеров, привязка к пациентам после конверсии.

## Модели БД

### `crm_leads`
| Поле | Тип | Описание |
|------|-----|----------|
| name | String(200) | ФИО лида |
| phone | String(50) | Телефон |
| email | String(200) | Email (опционально) |
| source | Enum | website/phone/walk_in/referral/social_media/whatsapp/advertisement |
| status | Enum | new/contacted/appointment_booked/visited/converted/lost |
| interested_in | String(300) | Интересующая услуга |
| assigned_to_id | UUID FK | Ответственный менеджер |
| patient_id | UUID FK | Привязанный пациент (после конверсии) |
| notes | Text | Заметки |
| tags | JSON | Теги |

## API эндпоинты

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|-------------|
| GET | `/crm/leads` | Список лидов (фильтр: status, source, search) | Staff |
| POST | `/crm/leads` | Создать лид | Staff |
| PATCH | `/crm/leads/{id}` | Обновить лид | Staff |
| DELETE | `/crm/leads/{id}` | Удалить лид (soft) | Staff |
| PATCH | `/crm/leads/{id}/status` | Изменить статус лида | Staff |
| GET | `/crm/leads/stats` | Воронка конверсии (кол-во по статусам, % конверсии) | Staff |
| GET | `/crm/leads/sources` | Лиды по источникам | Staff |

## Файлы

- **Модель:** `backend/app/models/crm.py`
- **Роуты:** `backend/app/api/v1/routes/crm.py`

## Связанные модули

- [[Биллинг]]
- [[Портал пациента]]
- [[WhatsApp запись на приём]]
