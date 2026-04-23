---
aliases: [Auth, RBAC, Роли, JWT]
tags: [backend, auth, rbac, security]
created: 2026-04-20
---

# Аутентификация и RBAC

## JWT Аутентификация

**Реализация:** `backend/app/core/security.py`

### Процесс
1. Пользователь отправляет `POST /api/v1/auth/login` (email + password)
2. Сервер проверяет пароль (bcrypt через Passlib)
3. Генерируется JWT токен (`python-jose`)
4. Токен содержит: `user_id`, `clinic_id`, `role`, `exp`
5. При выходе токен добавляется в Redis blacklist

### Конфигурация
- `JWT_SECRET_KEY` — секрет для подписи
- `ACCESS_TOKEN_EXPIRE_MINUTES` — время жизни токена
- `ALGORITHM` — HS256

## Роли пользователей (9+)

| Роль | Описание |
|------|----------|
| `admin` | Полный доступ к системе |
| `doctor` | Врач — пациенты, лечение, рецепты |
| `nurse` | Медсестра — витальные показатели, уход |
| `pharmacist` | Фармацевт — аптека, склад |
| `lab_tech` | Лаборант — анализы |
| `radiologist` | Рентгенолог — визуализация |
| `billing` | Бухгалтер — финансы |
| `receptionist` | Регистратор — приём пациентов |
| `patient` | Пациент (портал) |

## Динамический RBAC

**Сервис:** `backend/app/services/rbac.py` (19KB)
**Модели:** `backend/app/models/rbac.py`

### Компоненты
- **PermissionGroup** — группа прав (например, "Управление пациентами")
- **PermissionTemplate** — шаблон роли (набор групп прав)
- **UserTemplate** — привязка пользователя к шаблону
- Возможность override отдельных прав для конкретного пользователя

### Seed
`backend/seed_rbac.py` — создаёт шаблоны для всех ролей с предопределёнными правами.

## Портал пациента — отдельная авторизация

- Вход по **телефону + пароль** (не email)
- Отдельный JWT с `patient_id`
- Ограниченный доступ только к своим данным

## Frontend защита

- `auth-store.ts` — Zustand store с JWT и ролью
- `<RequireRole role="admin">` — компонент для ограничения доступа
- API клиент автоматически добавляет `Authorization: Bearer <token>`

## Связанные документы

- [[Backend Overview]]
- [[API Endpoints]]
- [[Портал пациента]]
