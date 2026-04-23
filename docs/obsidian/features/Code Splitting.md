---
aliases: [Code Splitting, Lazy Loading, Оптимизация бандла]
tags: [frontend, performance, optimization]
created: 2026-04-23
---

# Code Splitting (Оптимизация бандла)

> Разделение бандла на чанки для ускорения начальной загрузки. Тяжёлые страницы загружаются лениво, вендорные библиотеки вынесены в отдельные чанки.

---

## Lazy Imports

Файл `frontend/src/lib/lazy-imports.ts` содержит lazy-обёртки для тяжёлых страниц:

| Компонент | Маршрут |
|-----------|---------|
| `LazyReports` | `/reports` |
| `LazyPredictions` | `/predictions` |
| `LazyRBAC` | `/rbac` |
| `LazyScheduleCalendar` | `/schedule-calendar` |
| `LazySurgery` | `/surgery` |

> TanStack Router уже делает code splitting через file-based routing. Lazy-imports — дополнительный инструмент для ручного контроля.

## Manual Chunks (Vite)

В `frontend/vite.config.ts` настроено разделение вендорных библиотек:

| Чанк | Содержимое |
|------|-----------|
| `vendor-react` | `react`, `react-dom` |
| `vendor-router` | `@tanstack/react-router` |
| `vendor-query` | `@tanstack/react-query` |
| `vendor-charts` | `recharts` |
| `vendor-motion` | `framer-motion` |

Лимит размера чанка: **600 KB** (`chunkSizeWarningLimit`).

## Файлы

- `frontend/src/lib/lazy-imports.ts` — lazy-обёртки страниц
- `frontend/vite.config.ts` — конфигурация manual chunks

## Связанные модули

- [[Frontend Overview]]
- [[Маршрутизация]]
