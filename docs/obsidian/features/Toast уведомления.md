---
aliases: [Toast Notifications, Тосты]
tags: [feature, frontend, ui, toast, notifications]
created: 2026-04-23
---

# Toast уведомления

> Централизованные toast-сообщения для единообразного UX на всех страницах.

---

## Обзор

Модуль `toast-messages.ts` предоставляет объект `toasts` с готовыми функциями для типичных действий. Использует библиотеку `sonner`.

## Методы

### CRUD операции

| Метод | Пример вызова | Сообщение |
|-------|--------------|-----------|
| `created(entity)` | `toasts.created("Пациент")` | "Пациент создан(а) успешно" |
| `updated(entity)` | `toasts.updated("Профиль")` | "Профиль обновлён(а)" |
| `deleted(entity)` | `toasts.deleted("Запись")` | "Запись удалён(а)" |

### Действия

| Метод | Сообщение |
|-------|-----------|
| `saved()` | "Сохранено" |
| `sent()` | "Отправлено" |
| `copied()` | "Скопировано в буфер обмена" |

### Ошибки

| Метод | Сообщение |
|-------|-----------|
| `error(msg?)` | Пользовательское или "Произошла ошибка" |
| `networkError()` | "Ошибка сети. Проверьте подключение." |
| `forbidden()` | "Нет доступа к этому действию" |
| `notFound()` | "Не найдено" |

### Специфические

`loginSuccess`, `logoutSuccess`, `passwordChanged`, `profileUpdated`, `appointmentBooked`, `appointmentCancelled`, `prescriptionCreated`, `labOrderCreated`

### Кастомные

```ts
toasts.custom("Своё сообщение", "warning");
```

## Файлы

- `frontend/src/lib/toast-messages.ts`

## Зависимости

- `sonner`

## Связанные модули

- [[UI Компоненты]]
- [[Error Boundary]]
