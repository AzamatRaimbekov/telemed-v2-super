# ТЗ — Динамическое создание персонала + RBAC

Статус: В РАБОТЕ

## Концепция
Полностью динамическая система без жёстко зашитых ролей.
- Должность = свободный текст
- Permission templates заменяют статические роли
- Extra fields per template — конфигурируются в БД
- Individual overrides per user поверх шаблона

## Фазы реализации
- Phase 1: DB models + migrations + seed (groups, permissions, templates)
- Phase 2: Backend API (staff CRUD, templates, permissions)
- Phase 3: Frontend (staff list, 7-step wizard, template management)

## API (22 эндпоинта)
Staff: POST/GET/PATCH /staff, deactivate, reset-password, permissions grant/revoke
Templates: CRUD + duplicate + staff list + fields CRUD
Permissions: GET all grouped, GET groups
