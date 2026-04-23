---
aliases: [Clinic Map, 2GIS Integration, Google Maps]
tags: [feature, map, portal]
created: 2026-04-22
---

# Интеграция карт (2GIS / Google Maps / Яндекс)

Карта клиники с embed и ссылками на внешние картографические сервисы.

## Компоненты

### Backend API
- `GET /clinic-map/` — данные клиники: координаты, адрес, этажи, парковка, ссылки на карты

### Frontend (портал пациента)
- Google Maps iframe embed на странице «О клинике»
- Кнопки-ссылки: 2GIS, Google Maps, Яндекс Карты
- Координаты по умолчанию: Бишкек (42.8746, 74.5698)

## Файлы
- Backend: `backend/app/api/v1/routes/clinic_map.py`
- Frontend: `frontend/src/routes/portal/_portal/clinic-info.tsx` (обновлён)
