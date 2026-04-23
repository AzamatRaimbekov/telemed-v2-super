---
aliases: [Infection Control UI]
tags: [feature, infection-control, frontend]
created: 2026-04-23
---

# Контроль инфекций (UI)

Фронтенд для учёта инфекций и управления карантинными мерами.

## Страница `/infection-control`
- Вкладки: Все | Подозрение | Подтверждено | Мониторинг
- Счётчик активных случаев и карантинных палат
- Типы изоляции: контактная, капельная, воздушная, защитная
- Регистрация нового случая (пациент, тип инфекции, тип изоляции, палата, меры предосторожности)
- Действие: Разрешить инфекцию

**Файлы:**
- `frontend/src/features/infection-control/api.ts`
- `frontend/src/routes/_authenticated/infection-control.tsx`
