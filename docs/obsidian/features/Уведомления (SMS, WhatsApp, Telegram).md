---
aliases: [Notifications, SMS, WhatsApp, Telegram]
tags: [feature, notifications, sms, telegram]
created: 2026-04-21
---

# Уведомления (SMS, WhatsApp, Telegram)

Мультиканальная система уведомлений для пациентов и персонала.

## Каналы

| Канал | Назначение | API |
|-------|-----------|-----|
| SMS | Напоминания о приёмах | Nikita SMS (KG) |
| WhatsApp | Напоминания, результаты | WhatsApp Business API |
| Telegram | Алерты для персонала | Telegram Bot API |
| Email | Отчёты, документы | SMTP (уже есть) |
| In-App | Внутрисистемные | WebSocket (уже есть) |

## Telegram бот

1. Персонал генерирует токен через `POST /telegram/link`
2. Отправляет `/start <token>` боту
3. Бот связывает Telegram с аккаунтом
4. Персонал получает алерты в Telegram

## Celery Beat

`check_appointment_reminders` — каждые 15 минут проверяет приёмы в ближайшие 2 часа и отправляет SMS.

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/notification-logs/` | Журнал уведомлений |
| POST | `/api/v1/notification-logs/send` | Ручная отправка |
| GET | `/api/v1/notification-logs/stats` | Статистика по каналам |
| POST | `/api/v1/telegram/link` | Сгенерировать токен |
| POST | `/api/v1/telegram/unlink` | Отвязать Telegram |
| POST | `/api/v1/telegram/webhook` | Вебхук Telegram |

## Файлы

| Компонент | Путь |
|-----------|------|
| Модель | `backend/app/models/notification_log.py` |
| Диспетчер | `backend/app/services/notification_dispatcher.py` |
| Celery задачи | `backend/app/tasks/notification_tasks.py` |
| Маршруты | `backend/app/api/v1/routes/notification_logs.py` |
| Telegram бот | `backend/app/api/v1/routes/telegram_bot.py` |
| Frontend API | `frontend/src/features/notifications/api.ts` |
| Страница | `frontend/src/routes/_authenticated/notification-logs.tsx` |
