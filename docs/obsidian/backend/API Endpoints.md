---
aliases: [API, Эндпоинты, Routes]
tags: [backend, api, routes]
created: 2026-04-20
---

# API Endpoints

Все маршруты расположены в `backend/app/api/v1/routes/`.

## Аутентификация

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/auth/login` | Вход (email + пароль) |
| POST | `/api/v1/auth/refresh` | Обновление JWT токена |
| POST | `/api/v1/auth/logout` | Выход (blacklist токена в Redis) |

## Пользователи и клиники

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/users/` | Список пользователей |
| POST | `/api/v1/users/` | Создание пользователя |
| GET/PUT/DELETE | `/api/v1/users/{id}` | CRUD пользователя |
| GET | `/api/v1/clinics/` | Список клиник |
| POST | `/api/v1/clinics/` | Создание клиники |

## Пациенты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/patients/` | Список пациентов (фильтры, пагинация) |
| POST | `/api/v1/patients/` | Регистрация пациента |
| GET | `/api/v1/patients/{id}` | Карточка пациента |
| PUT | `/api/v1/patients/{id}` | Обновление данных |
| DELETE | `/api/v1/patients/{id}` | Удаление |
| POST | `/api/v1/registration/face-detect` | Face Detection при регистрации |
| POST | `/api/v1/registration/ocr` | OCR документов |

## Медицинские данные

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/v1/medical-history/` | История болезни |
| GET/POST | `/api/v1/diagnoses/` | Диагнозы |
| GET | `/api/v1/icd10/search` | Поиск по МКБ-10 |
| GET/POST | `/api/v1/treatment/plans` | Планы лечения |
| GET/POST | `/api/v1/vital-signs/` | Витальные показатели |

## Палаты и размещение

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/rooms/` | Список палат |
| POST | `/api/v1/rooms/assign` | Назначение на койку |
| DELETE | `/api/v1/rooms/discharge` | Выписка из палаты |

## Расписание и приёмы

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/v1/schedule/` | Расписание врачей |
| GET/POST | `/api/v1/appointments/` | Приёмы |
| PUT | `/api/v1/appointments/{id}/cancel` | Отмена приёма |

## Телемедицина

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/telemedicine/sessions` | Создание видеосессии (Daily.co) |
| GET | `/api/v1/telemedicine/sessions/{id}` | Данные сессии |
| POST | `/api/v1/telemedicine/messages` | Отправка сообщения |

## Лаборатория

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/v1/laboratory/orders` | Заказы анализов |
| PUT | `/api/v1/laboratory/results/{id}` | Внесение результатов |
| PUT | `/api/v1/laboratory/results/{id}/approve` | Утверждение результатов |

## Фармация

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/v1/pharmacy/drugs` | Каталог лекарств |
| GET/POST | `/api/v1/pharmacy/prescriptions` | Рецепты |
| GET/POST | `/api/v1/pharmacy/inventory` | Складские остатки |
| GET/POST | `/api/v1/pharmacy/suppliers` | Поставщики |
| GET/POST | `/api/v1/pharmacy/purchase-orders` | Заказы поставщикам |

## Биллинг

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/v1/billing/invoices` | Счета |
| POST | `/api/v1/billing/payments` | Платежи |

## Мониторинг (WebSocket)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/monitoring/devices` | Список датчиков |
| GET | `/api/v1/monitoring/readings` | Показания |
| GET | `/api/v1/monitoring/alerts` | Алерты |
| WS | `/api/v1/monitoring/ws` | Real-time обновления |

## BMS — Управление зданием (WebSocket)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/infrastructure/buildings` | Здания |
| GET | `/api/v1/infrastructure/sensors` | BMS датчики |
| GET | `/api/v1/infrastructure/equipment` | Оборудование |
| POST | `/api/v1/infrastructure/equipment/{id}/command` | Управление оборудованием |
| GET | `/api/v1/infrastructure/alerts` | BMS алерты |
| GET | `/api/v1/infrastructure/automation-rules` | Правила автоматизации |
| WS | `/api/v1/infrastructure/ws` | Real-time BMS данные |

## Портал пациента

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/portal/auth/login` | Вход пациента (телефон) |
| GET | `/api/v1/portal/profile` | Профиль |
| GET | `/api/v1/portal/medical-card` | Медкарта |
| GET | `/api/v1/portal/appointments` | Приёмы |
| POST | `/api/v1/portal/appointments` | Запись на приём |
| GET | `/api/v1/portal/lab-results` | Результаты анализов |
| GET | `/api/v1/portal/exercises` | Упражнения |
| POST | `/api/v1/portal/voice/process` | Голосовой запрос |

## AI

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/ai/analyze` | AI анализ данных |
| POST | `/api/v1/patient-ai/chat` | AI чат с пациентом |

## Связанные документы

- [[Backend Overview]]
- [[Аутентификация и RBAC]]
- [[Портал пациента]]
