# Room Monitoring System — Design Spec

## Overview

Новый таб "Мониторинг" в карточке пациента. Система видеонаблюдения палат с IoT-датчиками, алертами критических событий и полным циклом вызова медсестры.

Камеры — заглушки с placeholder-видео; архитектура проектируется под HLS/WebRTC для будущей интеграции с реальными IP-камерами (RTSP/ONVIF).

## Scope

### В скоупе
- Таб "Мониторинг" в карточке пациента (`/patients/:id/monitoring`)
- Камеры палаты: сетка (главная большая + миниатюры), заглушки
- Датчики пациента (носимые): пульс, SpO2, температура тела, давление, падение
- Датчики палаты (стационарные): температура помещения, влажность, движение, дверь
- Кнопка вызова медсестры: полный цикл (вызов → принял → в пути → на месте → решено)
- Алерты: push-уведомления + звуковой сигнал + баннер на странице
- История: лог алертов + графики трендов датчиков
- WebSocket для real-time данных, REST для CRUD и истории
- Mock-данные для всех датчиков и камер

### Вне скоупа
- Реальная интеграция с IP-камерами (RTSP/ONVIF/HLS/WebRTC)
- Реальные IoT-устройства (MQTT/BLE)
- Запись видео / воспроизведение архива
- Общая страница мониторинга всех палат клиники (только из карточки пациента)

---

## Architecture

### Backend

#### Новые модели (SQLAlchemy)

**RoomCamera**
- `id`, `clinic_id`, `room_id` (FK → Room)
- `name` (str) — "Общий вид", "У кровати", "Вход"
- `stream_url` (str, nullable) — URL потока (пусто для заглушек)
- `camera_type` (enum: OVERVIEW, BEDSIDE, ENTRANCE, OTHER)
- `is_active` (bool)
- `position_order` (int) — порядок отображения

**SensorDevice**
- `id`, `clinic_id`, `room_id` (FK → Room, nullable), `patient_id` (FK → Patient, nullable)
- `device_type` (enum: HEART_RATE, SPO2, BODY_TEMPERATURE, BLOOD_PRESSURE, FALL_DETECTOR, ROOM_TEMPERATURE, HUMIDITY, MOTION, DOOR, NURSE_CALL)
- `device_category` (enum: WEARABLE, STATIONARY)
- `name` (str)
- `serial_number` (str, nullable)
- `is_active` (bool)
- `last_reading_at` (datetime, nullable)

**SensorReading**
- `id`, `sensor_id` (FK → SensorDevice)
- `value` (float) — числовое значение
- `value_text` (str, nullable) — для состояний: "NORMAL", "FALL_DETECTED", "OPEN", "CLOSED"
- `unit` (str) — "bpm", "°C", "%", "mmHg"
- `recorded_at` (datetime)

**MonitoringAlert**
- `id`, `clinic_id`, `patient_id` (FK → Patient), `room_id` (FK → Room)
- `sensor_id` (FK → SensorDevice, nullable)
- `alert_type` (enum: FALL_DETECTED, HIGH_HEART_RATE, LOW_SPO2, HIGH_TEMPERATURE, LOW_TEMPERATURE, HIGH_BP, LOW_BP, NURSE_CALL, DEVICE_OFFLINE)
- `severity` (enum: INFO, WARNING, CRITICAL)
- `title` (str), `message` (str)
- `status` (enum: ACTIVE, ACKNOWLEDGED, RESOLVED)
- `acknowledged_by_id` (FK → User, nullable)
- `acknowledged_at` (datetime, nullable)
- `resolved_by_id` (FK → User, nullable)
- `resolved_at` (datetime, nullable)

**NurseCall**
- `id`, `clinic_id`, `patient_id`, `room_id`
- `status` (enum: CALLED, ACCEPTED, EN_ROUTE, ON_SITE, RESOLVED)
- `called_at` (datetime)
- `accepted_at`, `en_route_at`, `on_site_at`, `resolved_at` (datetime, nullable)
- `accepted_by_id`, `resolved_by_id` (FK → User, nullable)
- `response_time_seconds` (int, nullable) — время от вызова до прибытия
- `notes` (str, nullable)

#### Alert Thresholds (конфигурация порогов)

Жёстко заданные пороги в коде (начальная версия):

| Параметр | WARNING | CRITICAL |
|----------|---------|----------|
| Пульс | > 110 или < 50 | > 140 или < 40 |
| SpO2 | < 93% | < 88% |
| Темп. тела | > 37.5 или < 35.5 | > 39.0 или < 35.0 |
| Систолическое АД | > 150 или < 90 | > 180 или < 80 |
| Диастолическое АД | > 95 или < 55 | > 110 или < 50 |
| Темп. палаты | > 26 или < 18 | > 30 или < 15 |
| Влажность | > 70% или < 30% | > 80% или < 20% |

Падение — всегда CRITICAL.

#### REST API Endpoints

**Камеры:**
- `GET /monitoring/{patient_id}/cameras` — список камер палаты пациента
- `POST /monitoring/cameras` — добавить камеру
- `PATCH /monitoring/cameras/{camera_id}` — обновить
- `DELETE /monitoring/cameras/{camera_id}` — удалить

**Датчики:**
- `GET /monitoring/{patient_id}/sensors` — все датчики (и носимые пациента, и стационарные палаты)
- `GET /monitoring/{patient_id}/sensors/current` — текущие показания всех датчиков
- `GET /monitoring/{patient_id}/sensors/{sensor_id}/readings?from=&to=` — история показаний для графиков
- `POST /monitoring/sensors` — зарегистрировать датчик
- `PATCH /monitoring/sensors/{sensor_id}` — обновить
- `DELETE /monitoring/sensors/{sensor_id}` — удалить

**Алерты:**
- `GET /monitoring/{patient_id}/alerts?status=&severity=&limit=` — лог алертов
- `PATCH /monitoring/alerts/{alert_id}/acknowledge` — подтвердить алерт
- `PATCH /monitoring/alerts/{alert_id}/resolve` — закрыть алерт

**Вызов медсестры:**
- `GET /monitoring/{patient_id}/nurse-calls?status=&limit=` — история вызовов
- `POST /monitoring/{patient_id}/nurse-calls` — создать вызов (от имени датчика/кнопки)
- `PATCH /monitoring/nurse-calls/{call_id}/accept` — принять вызов
- `PATCH /monitoring/nurse-calls/{call_id}/en-route` — "в пути"
- `PATCH /monitoring/nurse-calls/{call_id}/on-site` — "на месте"
- `PATCH /monitoring/nurse-calls/{call_id}/resolve` — решено

#### WebSocket

**Endpoint:** `WS /monitoring/{patient_id}/ws`

Сервер отправляет клиенту JSON-сообщения:

```json
// Обновление датчика
{
  "type": "sensor_update",
  "sensor_id": "uuid",
  "device_type": "HEART_RATE",
  "value": 82,
  "unit": "bpm",
  "timestamp": "2026-04-16T12:00:00Z"
}

// Новый алерт
{
  "type": "alert",
  "alert": {
    "id": "uuid",
    "alert_type": "FALL_DETECTED",
    "severity": "CRITICAL",
    "title": "Падение пациента",
    "message": "Датчик зафиксировал падение в палате 204",
    "timestamp": "2026-04-16T12:00:00Z"
  }
}

// Обновление статуса вызова медсестры
{
  "type": "nurse_call_update",
  "call": {
    "id": "uuid",
    "status": "ACCEPTED",
    "accepted_by": "Иванова А.С.",
    "timestamp": "2026-04-16T12:00:00Z"
  }
}
```

Клиент может отправлять:
```json
// Подтвердить алерт
{ "type": "acknowledge_alert", "alert_id": "uuid" }

// Обновить статус вызова
{ "type": "update_nurse_call", "call_id": "uuid", "status": "ACCEPTED" }
```

#### Mock Data Generator

Celery-задача или фоновый asyncio task, генерирующий реалистичные данные каждые 5 секунд:
- Пульс: случайные колебания 65-85 bpm с редкими выбросами
- SpO2: 95-99% с редкими падениями
- Температура тела: 36.4-36.8 с плавными изменениями
- Давление: 115-130/70-85 с вариациями
- Температура палаты: 21-23°C, медленные изменения
- Влажность: 45-55%, медленные изменения
- Движение: random on/off
- Дверь: редкие открытия/закрытия
- Падение: очень редкое событие (1 раз в ~30 минут для демо)

---

### Frontend

#### Расположение

Новый файл: `routes/_authenticated/patients.$patientId/monitoring.tsx`

Новый таб в `patients.$patientId.tsx`:
```
{ path: "monitoring", label: "Мониторинг", icon: MonitorIcon }
```

#### Структура страницы (сверху вниз)

1. **Alert Banner** — красный баннер при активных CRITICAL алертах, со звуком. Кнопка "Подтвердить".

2. **Датчики пациента** — горизонтальный ряд карточек:
   - Пульс (bpm), SpO2 (%), Температура тела (°C), Давление (мм рт.ст.), Статус падения
   - Цветовая индикация: зелёный (норма), жёлтый (warning), красный (critical)
   - Анимация пульсации при критических значениях

3. **Камеры** — сетка:
   - Главная камера: 60% ширины, полная высота
   - Остальные камеры: стопкой справа (40%)
   - Клик на маленькую камеру — она становится главной
   - Placeholder: стилизованный блок с иконкой камеры и названием
   - Индикатор "LIVE" (зелёная точка)

4. **Датчики палаты** — компактный ряд:
   - Температура помещения, Влажность, Движение, Дверь (открыта/закрыта)

5. **Вызов медсестры** — карточка со статусом:
   - Текущий статус вызова с таймером
   - Кнопки действий: "Принять", "В пути", "На месте", "Решено"
   - История вызовов (последние 5)

6. **Лог алертов** — таблица/список:
   - Время, тип, severity, статус
   - Фильтр по severity и статусу
   - Кнопки "Подтвердить" / "Закрыть"

7. **Графики трендов** — раздел с мини-графиками:
   - Переключатель периода: 1ч / 6ч / 24ч / 7д
   - Линейные графики: пульс, SpO2, температура тела, давление
   - Горизонтальные пороговые линии (warning/critical)

#### WebSocket Hook

Кастомный хук `useMonitoringWebSocket(patientId)`:
- Подключение к `WS /monitoring/{patient_id}/ws`
- Автопереподключение при обрыве
- Обновление React Query cache при получении `sensor_update`
- Показ toast + звук при получении `alert`
- Обновление статуса nurse_call в реальном времени

#### Звуковые алерты

- WARNING: короткий одиночный звук
- CRITICAL: тройной сигнал, повтор каждые 10 сек пока не подтвердят
- Падение: непрерывный сигнал до подтверждения
- Web Audio API для генерации звуков (без загрузки файлов)

---

### Database Migrations

Одна миграция Alembic:
- Таблицы: `room_cameras`, `sensor_devices`, `sensor_readings`, `monitoring_alerts`, `nurse_calls`
- Индексы на: `patient_id`, `room_id`, `sensor_id + recorded_at`, `alert status + severity`
- `sensor_readings` — потенциально большая таблица, индекс на `(sensor_id, recorded_at DESC)`

---

### Mock Data Seeder

`seed_monitoring.py`:
- Для каждой палаты с пациентом: 2-3 камеры, датчики палаты
- Для каждого госпитализированного пациента: носимые датчики
- 7 дней истории sensor_readings (каждые 5 минут)
- 20-30 алертов разной severity
- 5-10 nurse_calls с полным циклом

---

## Design System Compliance

Все компоненты используют существующую дизайн-систему проекта:
- CSS переменные: `var(--color-surface)`, `var(--color-muted)`, `var(--color-text-secondary)`, `var(--color-text-tertiary)`, `border-border`
- Скругления: `rounded-2xl`
- Анимации: `animate-float-up` с `animationDelay`
- Карточки: `bg-[var(--color-surface)] rounded-2xl border border-border p-6`
- Badge: компонент `<Badge>` для статусов
- Цвета статусов: `text-success`, `text-warning`, `text-destructive`, `text-secondary`
- Skeleton loading: `animate-pulse` с `bg-[var(--color-muted)]`

---

## Testing Strategy

- Backend: unit-тесты для сервиса (пороговая логика, CRUD), интеграционные для WS
- Frontend: компонент рендерится без ошибок, mock WS данные обновляют UI
- E2E: открыть таб мониторинга, увидеть данные, подтвердить алерт
