---
aliases: [Frontend, Клиентская часть]
tags: [frontend, react, typescript]
created: 2026-04-20
---

# Frontend Overview

## Архитектура

React 18 + TypeScript + TanStack Router (file-based routing) + Zustand + TanStack Query.

**Entry point:** `frontend/src/main.tsx` → `App.tsx`

## Структура

### Маршрутизация (`src/routes/`)

Две основные зоны:

#### Админ-панель (`_authenticated/`)
Для врачей, медсестёр, администраторов и другого персонала.

| Страница | Файл | Описание |
|----------|------|----------|
| Dashboard | `dashboard.tsx` | Главная панель |
| Пациенты | `patients.index.tsx` | Список пациентов |
| Новый пациент | `patients.new.tsx` (55KB) | Форма регистрации |
| Карточка пациента | `patients.$patientId.tsx` | Детали пациента |
| Персонал | `staff.index.tsx` | Список сотрудников |
| Новый сотрудник | `staff.new.tsx` (50KB) | Форма создания |
| Расписание | `schedule.tsx` | Календарь приёмов |
| Телемедицина | `telemedicine.tsx` | Видеоконсультации |
| Лаборатория | `laboratory.tsx` | Анализы |
| Аптека | `medicine-settings.tsx` (90KB) | Управление фармацией |
| Финансы | `finance.tsx` | Биллинг |
| Аналитика | `analytics.tsx` | Отчёты |
| Аудит | `audit.tsx` | Журнал действий |
| Уведомления | `notifications.tsx` | Уведомления |
| Инфраструктура | `infrastructure.tsx` + 8 подроутов | BMS |

**Вложенные маршруты пациента** (`patients.$patientId/`):
- `medical-card/` — медкарта
- `history/` — история болезни
- `treatment/` — лечение
- `labs/` — анализы
- `procedures/` — процедуры
- `medications/` — лекарства
- `stroke/` — инсульт-реабилитация
- `documents/` — документы
- `billing/` — счета

#### Портал пациента (`portal/`)
Отдельная зона для пациентов.

| Страница | Файл | Описание |
|----------|------|----------|
| Вход | `login.tsx` | Телефон + пароль |
| Dashboard | `dashboard.tsx` | Главная портала |
| Медкарта | `medical-card.tsx` | Просмотр медкарты |
| История | `history.tsx` (36KB) | История болезни |
| Результаты | `results.tsx` | Анализы |
| Приёмы | `appointments.tsx` (37KB) | Запись к врачу |
| Упражнения | `exercises.tsx` (22KB) | Каталог |
| Сессия | `exercise-session.tsx` (43KB) | MediaPipe видео |
| Прогресс | `exercise-progress.tsx` | Статистика |
| Восстановление | `recovery.tsx` (22KB) | Цели и прогресс |
| Лечение | `treatment.tsx` (23KB) | Планы лечения |
| Сообщения | `messages.tsx` | Чат с врачом |
| Биллинг | `billing.tsx` | Счета |
| Профиль | `profile.tsx` (25KB) | Настройки |
| Расписание | `schedule.tsx` | Расписание |

### Feature-модули (`src/features/`)

14 модулей — каждый содержит `api.ts` + опционально types, hooks, components:

- `auth/` — авторизация
- `patients/` — пациенты
- `staff/` — персонал
- `portal/` — портал пациента
- `pharmacy/` — фармация
- `laboratory/` — лаборатория
- `finance/` — биллинг
- `monitoring/` — мониторинг (+ WebSocket хук)
- `infrastructure/` — BMS (+ WebSocket хук)
- `recovery/` — реабилитация (+ calculator)
- `settings/` — настройки
- `voice-assistant/` — [[Голосовой ассистент]] (полный модуль)

### UI компоненты (`src/components/`)

**Дизайн-система** (`ui/`):
- `button.tsx` — Button (primary, secondary, outline, ghost, destructive)
- `badge.tsx` — Badge (success, warning, destructive)
- `input-field.tsx` — TextInput с label/error
- `textarea-field.tsx` — Textarea
- `select-custom.tsx` — Custom Select
- `tag-input.tsx` — Tag/Chip input
- `date-picker.tsx` — DatePicker
- `data-table.tsx` — DataTable (сортировка, пагинация)
- `print-layout.tsx` — Print-friendly layout

**Общие** (`shared/`):
- `page-header.tsx` — Заголовок страницы
- `loading-skeleton.tsx` — Skeleton loader
- `require-role.tsx` — Role guard

### Стейт-менеджмент (`src/stores/`)

- `auth-store.ts` — Zustand: JWT, user, role, clinic_id

### API клиенты (`src/lib/`)

- `api-client.ts` — Axios для админки (+ interceptors для JWT)
- `portal-api-client.ts` — Axios для портала пациента
- `query-client.ts` — TanStack Query config
- `notifications-api.ts` — Polling уведомлений

## Связанные документы

- [[Маршрутизация]]
- [[UI Компоненты]]
- [[Стейт-менеджмент]]
- [[Голосовой ассистент]]
