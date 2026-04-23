---
aliases: [Command Palette, Global Search, Cmd+K]
tags: [feature, ux, search]
created: 2026-04-23
---

# Глобальный поиск (Cmd+K)

Быстрый поиск по всей системе — страницы, пациенты, действия.

## Горячие клавиши
- `Cmd+K` (Mac) / `Ctrl+K` (Win) — открыть поиск
- `↑↓` — навигация по результатам
- `Enter` — открыть выбранное
- `Esc` — закрыть

## Что ищет
- Все страницы системы (навигация)
- Пациентов по ФИО (API поиск с debounce 300ms)
- Быстрые действия

## Файлы
| Компонент | Путь |
|-----------|------|
| Компонент | `frontend/src/components/shared/command-palette.tsx` |
| Layout | `frontend/src/routes/_authenticated.tsx` |
