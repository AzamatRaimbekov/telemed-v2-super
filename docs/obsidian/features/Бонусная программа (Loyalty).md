---
aliases: [Loyalty, Bonus System, Бонусы]
tags: [feature, loyalty, portal]
created: 2026-04-22
---

# Бонусная программа (Loyalty)

## Описание

Система лояльности для пациентов: начисление и списание баллов, уровни (тиры), история транзакций.

## Модели БД

### `loyalty_accounts`
| Поле | Тип | Описание |
|------|-----|----------|
| patient_id | UUID FK | Пациент |
| balance | int | Текущий баланс баллов |
| total_earned | int | Всего начислено |
| total_spent | int | Всего потрачено |
| tier | string | bronze / silver / gold / platinum |

### `points_transactions`
| Поле | Тип | Описание |
|------|-----|----------|
| account_id | UUID FK | Аккаунт лояльности |
| amount | int | Сумма (+ начисление, - списание) |
| transaction_type | enum | earned / spent / bonus / expired |
| description | string | Описание операции |
| reference_id | UUID | Связь с оплатой, визитом и т.д. |

## Уровни (тиры)

| Уровень | Порог (total_earned) |
|---------|---------------------|
| Бронза | 0 |
| Серебро | 500 |
| Золото | 2000 |
| Платина | 5000 |

## API эндпоинты

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|-------------|
| GET | `/loyalty/balance` | Баланс и тир | Portal |
| GET | `/loyalty/history` | История транзакций | Portal |
| POST | `/loyalty/earn` | Начислить баллы | Staff (admin) |
| POST | `/loyalty/spend` | Списать баллы | Portal |

## Файлы

- **Модель:** `backend/app/models/loyalty.py`
- **Сервис:** `backend/app/services/loyalty_service.py`
- **Роуты:** `backend/app/api/v1/routes/loyalty.py`
- **Frontend API:** `frontend/src/features/loyalty/api.ts`
- **Страница:** `frontend/src/routes/portal/_portal/loyalty.tsx`

## Связанные модули

- [[Портал пациента]]
- [[Биллинг]]
