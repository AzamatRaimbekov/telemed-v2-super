---
aliases: [Referrals UI]
tags: [feature, referrals, frontend]
created: 2026-04-23
---

# Направления между врачами (UI)

Фронтенд для системы направлений.

## Страница `/referrals`
- Вкладки: Входящие | Исходящие
- Карточки направлений с priority и status бейджами
- Accept/Decline на входящих
- Создание нового направления через модалку

**Файлы:**
- `frontend/src/features/referrals/api.ts`
- `frontend/src/routes/_authenticated/referrals.tsx`
