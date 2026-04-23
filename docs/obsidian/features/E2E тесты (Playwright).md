---
aliases: [E2E Tests, Playwright, Тесты]
tags: [quality, testing, e2e]
created: 2026-04-23
---

# E2E тесты (Playwright)

> Сквозные тесты пользовательских сценариев с Playwright.

## Расположение

- Конфигурация: `frontend/playwright.config.ts`
- Тесты: `frontend/e2e/`
- Зависимость: `@playwright/test`

## Тестовые сценарии

### Landing (`landing.spec.ts`)
- Загрузка лендинга, проверка title
- Наличие кнопки "Заказать демо"
- Навигация на страницу логина

### Авторизация (`auth.spec.ts`)
- Отображение формы логина (email + пароль)
- Ошибка при неверных учётных данных
- Подсказка демо-аккаунта (admin@medcore.kg)

### Портал пациента (`portal.spec.ts`)
- Отображение страницы входа в портал
- Редирект неавторизованных на portal/login

### Публичные страницы (`lobby.spec.ts`)
- Загрузка страницы лобби

## Запуск

```bash
cd frontend

# Установить браузеры (один раз)
npx playwright install chromium

# Запуск тестов
pnpm test:e2e

# UI режим (интерактивный)
pnpm test:e2e:ui
```

## Конфигурация

- **baseURL:** `http://localhost:4000`
- **Браузер:** Chromium (headless)
- **Таймаут:** 30 сек
- **Ретраи:** 1
- **Скриншоты:** только при падении

## Связанные модули

- [[CI-CD Pipeline]] — интеграция в CI
- [[Frontend Overview]] — архитектура фронтенда
