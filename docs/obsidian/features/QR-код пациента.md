---
aliases: [QR Code, QR-код]
tags: [feature, qr, patient]
created: 2026-04-21
---

# QR-код пациента

Генерация QR-кода для быстрой идентификации пациента без физической карточки.

## Возможности

- Генерация QR-кода с UUID пациента
- Сканирование QR камерой на регистратуре
- Ручной ввод ID пациента
- Печать QR-бейджа

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/qr/patients/{id}/qr` | Получить QR-код как PNG |
| GET | `/api/v1/qr/scan/{id}` | Разрешить QR в данные пациента |

## Файлы

| Компонент | Путь |
|-----------|------|
| Сервис | `backend/app/services/qr_generator.py` |
| Маршрут | `backend/app/api/v1/routes/qr.py` |
| Frontend API | `frontend/src/features/qr/api.ts` |
| Страница | `frontend/src/routes/_authenticated/qr-scan.tsx` |

## Связанные документы

- [[Портал пациента]]
- [[API Endpoints]]
