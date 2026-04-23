---
aliases: [Real-time Dashboard, WebSocket Dashboard]
tags: [feature, websocket, dashboard]
created: 2026-04-22
---

# Реалтайм дашборд (WebSocket)

## Описание

WebSocket-эндпоинт для пуш-обновлений дашборда в реальном времени. Данные обновляются каждые 10 секунд без перезагрузки страницы.

## Архитектура

### Backend

- **Файл:** `backend/app/api/v1/routes/dashboard_ws.py`
- **Эндпоинт:** `WS /api/v1/ws/dashboard`
- Каждые 10 секунд отправляет JSON с текущей статистикой
- Использует `async_session_factory` для прямого доступа к БД

### Frontend

- **Hook:** `frontend/src/hooks/useDashboardWS.ts`
- React-хук `useDashboardWS()` возвращает `{ data, connected }`
- Автоматическое определение `ws://` или `wss://` по протоколу страницы

## Формат данных

```json
{
  "type": "dashboard_update",
  "patients_total": 142,
  "timestamp": "2026-04-22T10:30:00.000000"
}
```

## Использование

```tsx
import { useDashboardWS } from "@/hooks/useDashboardWS";

function Dashboard() {
  const { data, connected } = useDashboardWS();
  return <div>{connected ? `Пациентов: ${data?.patients_total}` : "Нет связи"}</div>;
}
```

## Связанные модули

- [[Дашборд главврача]]
- [[Мониторинг пациентов]]
