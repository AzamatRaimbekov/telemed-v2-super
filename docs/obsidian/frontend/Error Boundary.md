---
aliases: [ErrorBoundary, Обработка ошибок, Границы ошибок]
tags: [frontend, error-handling, quality]
created: 2026-04-23
---

# Error Boundary

> React-компонент для перехвата ошибок рендеринга, предотвращающий "белый экран смерти".

## Расположение

- Компонент: `frontend/src/components/shared/error-boundary.tsx`
- Интеграция: `frontend/src/routes/_authenticated.tsx`

## Возможности

- Перехват ошибок рендеринга дочерних компонентов
- Русскоязычный интерфейс ошибки
- Кнопка "Обновить страницу"
- Кнопка "На главную" (ссылка на /dashboard)
- Детали ошибки (stack trace) в development-режиме
- Поддержка кастомного fallback через проп

## Использование

```tsx
import { ErrorBoundary } from "@/components/shared/error-boundary";

// Базовое использование
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// С кастомным fallback
<ErrorBoundary fallback={<div>Ошибка загрузки</div>}>
  <MyComponent />
</ErrorBoundary>
```

## Интеграция

Обёрнут вокруг `<Outlet />` в `_authenticated.tsx`, защищая все авторизованные страницы от краша всего приложения.

```tsx
<main className="p-4 lg:p-6 xl:p-8">
  <ErrorBoundary>
    <Outlet />
  </ErrorBoundary>
</main>
```

## Дизайн

- Иконка `AlertTriangle` (lucide-react)
- Цвета через CSS-переменные (поддержка тёмной темы)
- Адаптивная вёрстка (min-h-[400px], max-w-md)

## Связанные модули

- [[Frontend Overview]] — архитектура фронтенда
- [[UI Компоненты]] — дизайн-система
