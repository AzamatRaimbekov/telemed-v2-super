---
aliases: [Surgery UI, Хирургия]
tags: [feature, surgery, frontend]
created: 2026-04-23
---

# Операции (UI)

Фронтенд для планирования и ведения хирургических операций.

## Страница `/surgery`
- Вкладки: Все | Запланированные | В процессе | Завершённые
- Карточки операций со статус-бейджами (planned, in_progress, completed, cancelled, postponed)
- Создание новой операции (название, пациент, дата, операционная, тип анестезии)
- Действия: Начать / Завершить / Отменить операцию

**Файлы:**
- `frontend/src/features/surgery/api.ts`
- `frontend/src/routes/_authenticated/surgery.tsx`
