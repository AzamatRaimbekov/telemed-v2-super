---
aliases: [AI Summarization, Суммаризация визита]
tags: [feature, ai, visit, summarization]
created: 2026-04-22
---

# AI-суммаризация визита

Врач диктует или вводит текст приёма — AI генерирует структурированную медицинскую запись.

## Как работает

```
Врач вводит текст → AI (Gemini/DeepSeek) → Структурированная запись → Врач утверждает
```

## Структура записи (7 полей)

| Поле | Описание |
|------|----------|
| chief_complaint | Основная жалоба пациента |
| history_of_present_illness | Анамнез — когда началось, развитие |
| examination | Данные осмотра |
| diagnosis | Предварительный диагноз |
| treatment_plan | Назначенное лечение |
| recommendations | Рекомендации пациенту |
| follow_up | Когда следующий приём |

## Статусы

| Статус | Описание |
|--------|----------|
| `processing` | AI обрабатывает |
| `draft` | Черновик — ожидает проверки врача |
| `approved` | Утверждён врачом |
| `rejected` | Отклонён |

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/visit-summaries/` | Создать из текста |
| POST | `/api/v1/visit-summaries/audio` | Создать из аудио |
| GET | `/api/v1/visit-summaries/` | Список (фильтры: patient_id, status) |
| GET | `/api/v1/visit-summaries/{id}` | Детали |
| PATCH | `/api/v1/visit-summaries/{id}/approve` | Утвердить |
| PATCH | `/api/v1/visit-summaries/{id}/reject` | Отклонить |
| PATCH | `/api/v1/visit-summaries/{id}` | Редактировать поля |

## AI провайдеры

Приоритет: Gemini → DeepSeek → пустая структура (fallback).

## Файлы

| Компонент | Путь |
|-----------|------|
| Модель | `backend/app/models/visit_summary.py` |
| AI сервис | `backend/app/services/ai_summarizer.py` |
| Маршрут | `backend/app/api/v1/routes/visit_summary.py` |
| Frontend API | `frontend/src/features/visit-summary/api.ts` |
| Страница | `frontend/src/routes/_authenticated/visit-summaries.tsx` |

## Связанные документы

- [[Голосовой ассистент]]
- [[Backend Overview]]
