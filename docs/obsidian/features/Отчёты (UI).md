---
aliases: [Reports UI, Аналитика]
tags: [feature, reports, frontend]
created: 2026-04-23
---

# Отчёты (UI)

Единая страница аналитики по врачам, отделениям и финансам.

## Страница `/reports`
- Вкладка **Врачи**: эффективность врачей, топ-5 рейтинг по score и количеству приёмов
- Вкладка **Отделения**: загруженность отделений, занятость коек
- Вкладка **Финансы**: P&L отчёт, дневная выручка (графики Recharts)

## Визуализация
Используются компоненты Recharts: BarChart, LineChart с CartesianGrid, Tooltip, Legend.

**Файлы:**
- `frontend/src/features/reports/api.ts`
- `frontend/src/routes/_authenticated/reports.tsx`
