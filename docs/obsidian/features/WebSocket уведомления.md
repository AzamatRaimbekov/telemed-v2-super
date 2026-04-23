---
aliases: [WebSocket Notifications, WS Push]
tags: [feature, backend, frontend, realtime]
created: 2026-04-23
---

# WebSocket уведомления (Push Notifications)

> Реалтайм push-уведомления через WebSocket. Сервер отправляет события пользователям мгновенно без polling.

---

## Архитектура

### Backend

**ConnectionManager** (`backend/app/services/ws_manager.py`):
- Хранит активные WebSocket соединения по `user_id`
- Поддерживает несколько вкладок/устройств на пользователя
- Автоматически очищает отключённые соединения

**WebSocket эндпоинт** (`backend/app/api/v1/routes/ws_notifications.py`):
- `ws://host/api/v1/ws/notifications?token=JWT` — подключение
- `GET /api/v1/ws/online-count` — количество онлайн-пользователей

### Frontend

**React хук** (`frontend/src/hooks/useRealtimeNotifications.ts`):
- Автоматическое подключение при наличии токена
- Ping/pong каждые 30 секунд для keepalive
- Callback `onMessage` для обработки входящих событий

---

## Использование

### Backend — отправка уведомления
```python
from app.services.ws_manager import ws_manager

# Отправить конкретному пользователю
await ws_manager.send_to_user(user_id, {
    "type": "new_appointment",
    "data": {"doctor": "Иванов", "time": "14:00"}
})

# Broadcast всем
await ws_manager.broadcast({"type": "system_alert", "message": "Обновление системы"})
```

### Frontend — подписка
```tsx
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

function App() {
  const { connected, onlineCount } = useRealtimeNotifications((msg) => {
    if (msg.type === "new_appointment") {
      toast.info(`Новая запись: ${msg.data.doctor}`);
    }
  });

  return <div>Онлайн: {onlineCount}</div>;
}
```

---

## Типы сообщений

| type | Описание |
|------|---------|
| `connected` | Успешное подключение |
| `new_appointment` | Новая запись на приём |
| `lab_result` | Готов результат анализа |
| `system_alert` | Системное уведомление |

---

## Аутентификация

JWT токен передаётся через query-параметр `?token=`. Сервер декодирует токен и извлекает `user_id` из поля `sub` или `user_id`.

---

## Файлы

- `backend/app/services/ws_manager.py` — ConnectionManager
- `backend/app/api/v1/routes/ws_notifications.py` — WebSocket роут
- `frontend/src/hooks/useRealtimeNotifications.ts` — React хук
