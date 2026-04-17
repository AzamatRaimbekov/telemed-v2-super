# BMS Dashboard + IoT Building Sensors — Design Spec

## Overview

Первая подсистема модуля "Инфраструктура (BMS)" — общий дашборд здания и IoT датчики. Полный умный контроль: мониторинг, управление оборудованием, автоматизация с правилами. Доступно только супер-админу.

Это подсистема 1 из 7. Остальные (HVAC, электричество, безопасность, водоснабжение, лифты, аналитика) будут реализованы отдельными циклами поверх этого фундамента.

## Scope

### В скоупе
- Раздел "Инфраструктура" в сайдбаре с подменю
- Настраиваемая структура здания: Building → Floor → Zone → Room
- Интерактивная карта этажа на CSS Grid с помещениями и датчиками
- 10 типов IoT датчиков здания с порогами и алертами
- Дашборд BMS с KPI, статусами этажей, алертами, правилами
- Управление оборудованием (вкл/выкл/параметры) — заглушки
- Правила автоматизации (условие → действие, расписание)
- WebSocket для real-time обновлений
- Мок-данные: 4-этажное здание, датчики, 7 дней истории, алерты, правила
- Уведомления: через общую систему (колокольчик) + звук/push для critical

### Вне скоупа
- Реальная интеграция с IoT протоколами (MQTT, Modbus, BACnet)
- Реальное управление оборудованием (только заглушки в БД)
- Подсистемы HVAC, электричество, безопасность, водоснабжение, лифты, аналитика (отдельные спеки)
- 3D-визуализация здания
- Мобильное приложение BMS

---

## Navigation

Новый раздел **"Инфраструктура"** в сайдбаре (`_authenticated.tsx`), видимый только ролям SUPER_ADMIN и CLINIC_ADMIN.

Подменю:
- `/infrastructure/dashboard` — Дашборд
- `/infrastructure/map` — Карта здания
- `/infrastructure/equipment` — Оборудование
- `/infrastructure/automation` — Автоматизация
- `/infrastructure/settings` — Настройки (этажи, зоны, помещения)

Будущие пункты (пока disabled/скрыты):
- HVAC, Электричество, Безопасность, Водоснабжение, Лифты, Аналитика

---

## Data Models

### Building
- `id`, `clinic_id` (TenantMixin)
- `name` (str) — "MedCore Clinic"
- `address` (str, nullable)
- `total_floors` (int)
- `description` (text, nullable)

### Floor
- `id`, `clinic_id` (TenantMixin)
- `building_id` (FK → buildings)
- `floor_number` (int) — -1 для подвала, 0 для цоколя, 1+ для этажей
- `name` (str) — "Подвал", "1 этаж"
- `grid_cols` (int, default 8) — ширина сетки
- `grid_rows` (int, default 6) — высота сетки
- `sort_order` (int)

### Zone
- `id`, `clinic_id` (TenantMixin)
- `floor_id` (FK → floors)
- `name` (str) — "Левое крыло", "Серверный блок"
- `color` (str) — hex-цвет для карты, e.g. "#3B82F6"

### BmsRoom
- `id`, `clinic_id` (TenantMixin)
- `floor_id` (FK → floors)
- `zone_id` (FK → zones, nullable)
- `name` (str) — "Серверная", "Палата 201"
- `room_type` (enum: WARD, CORRIDOR, SERVER, TECHNICAL, OFFICE, OPERATING, LAB, RECEPTION, PHARMACY, STORAGE, BATHROOM, KITCHEN, OTHER)
- `grid_x` (int) — позиция на сетке
- `grid_y` (int)
- `grid_w` (int, default 1) — ширина в ячейках
- `grid_h` (int, default 1) — высота в ячейках
- `linked_room_id` (FK → rooms, nullable) — связь с существующей Room из facility.py (для палат)

### BmsSensor
- `id`, `clinic_id` (TenantMixin)
- `bms_room_id` (FK → bms_rooms)
- `floor_id` (FK → floors) — для быстрых запросов по этажу
- `sensor_type` (enum: TEMPERATURE, HUMIDITY, CO2, LIGHT, SMOKE, WATER_LEAK, MOTION, DOOR_SENSOR, POWER_METER, PIPE_TEMPERATURE)
- `name` (str)
- `serial_number` (str, nullable)
- `is_active` (bool)
- `last_value` (float, nullable) — кэш последнего значения для быстрого отображения
- `last_value_text` (str, nullable)
- `last_reading_at` (datetime, nullable)
- `grid_x_offset` (float, default 0.5) — позиция датчика внутри помещения (0-1)
- `grid_y_offset` (float, default 0.5)

### BmsSensorReading
- `id` (UUID pk, no TenantMixin — high volume)
- `sensor_id` (FK → bms_sensors)
- `value` (float, nullable)
- `value_text` (str, nullable) — "DETECTED", "OPEN", "CLOSED"
- `unit` (str)
- `recorded_at` (datetime)
- Index: `(sensor_id, recorded_at DESC)`

### Equipment
- `id`, `clinic_id` (TenantMixin)
- `bms_room_id` (FK → bms_rooms)
- `equipment_type` (enum: AC, HEATER, LIGHT, VENTILATION, DOOR_LOCK, ELEVATOR, PUMP, GENERATOR, UPS, OTHER)
- `name` (str)
- `model` (str, nullable) — модель оборудования
- `status` (enum: ON, OFF, ERROR, MAINTENANCE, STANDBY)
- `parameters` (JSON, nullable) — текущие параметры {"temperature": 22, "mode": "cool", "brightness": 80}
- `is_controllable` (bool, default True)
- `last_status_change` (datetime, nullable)

### EquipmentCommand
- `id`, `clinic_id` (TenantMixin)
- `equipment_id` (FK → equipment)
- `command` (enum: TURN_ON, TURN_OFF, SET_PARAMETER, RESTART)
- `parameters` (JSON, nullable) — {"temperature": 24}
- `issued_by_id` (FK → users)
- `issued_at` (datetime)
- `status` (enum: PENDING, EXECUTED, FAILED)
- `executed_at` (datetime, nullable)
- `error_message` (str, nullable)

### BmsAlert
- `id`, `clinic_id` (TenantMixin)
- `floor_id` (FK → floors, nullable)
- `bms_room_id` (FK → bms_rooms, nullable)
- `sensor_id` (FK → bms_sensors, nullable)
- `equipment_id` (FK → equipment, nullable)
- `alert_type` (enum: HIGH_TEMPERATURE, LOW_TEMPERATURE, HIGH_HUMIDITY, LOW_HUMIDITY, HIGH_CO2, SMOKE_DETECTED, WATER_LEAK, POWER_OUTAGE, EQUIPMENT_ERROR, DOOR_FORCED, MOTION_AFTER_HOURS, SENSOR_OFFLINE, PIPE_FREEZE_RISK)
- `severity` (enum: INFO, WARNING, CRITICAL, EMERGENCY)
- `title` (str)
- `message` (text)
- `status` (enum: ACTIVE, ACKNOWLEDGED, RESOLVED, AUTO_RESOLVED)
- `acknowledged_by_id` (FK → users, nullable)
- `acknowledged_at` (datetime, nullable)
- `resolved_by_id` (FK → users, nullable)
- `resolved_at` (datetime, nullable)

### AutomationRule
- `id`, `clinic_id` (TenantMixin)
- `name` (str) — "Авто-кондиционер палаты"
- `description` (text, nullable)
- `is_active` (bool, default True)
- `condition_sensor_type` (str) — тип датчика для условия
- `condition_operator` (enum: GT, LT, EQ, GTE, LTE) — оператор сравнения
- `condition_value` (float) — пороговое значение
- `condition_floor_id` (FK → floors, nullable) — ограничение по этажу
- `condition_room_id` (FK → bms_rooms, nullable) — ограничение по помещению
- `action_equipment_type` (str, nullable) — тип оборудования для действия
- `action_equipment_id` (FK → equipment, nullable) — конкретное оборудование
- `action_command` (str) — TURN_ON, TURN_OFF, SET_PARAMETER
- `action_parameters` (JSON, nullable) — {"temperature": 22}
- `schedule_cron` (str, nullable) — cron-выражение для расписания, e.g. "0 22 * * *"
- `schedule_description` (str, nullable) — "Пн-Пт после 22:00"
- `last_triggered_at` (datetime, nullable)
- `trigger_count` (int, default 0)

### AutomationLog
- `id` (UUID pk, no TenantMixin)
- `rule_id` (FK → automation_rules)
- `triggered_at` (datetime)
- `sensor_value` (float, nullable) — значение датчика при срабатывании
- `action_taken` (str) — описание выполненного действия
- `success` (bool)
- `error_message` (str, nullable)

---

## Alert Thresholds

| Тип датчика | WARNING | CRITICAL |
|------------|---------|----------|
| TEMPERATURE | <18 или >28 | <15 или >32 |
| HUMIDITY | <30 или >70 | <20 или >80 |
| CO2 | >1000 ppm | >1500 ppm |
| LIGHT | <100 или >800 lux | <50 или >1000 lux |
| SMOKE | — | DETECTED |
| WATER_LEAK | — | DETECTED |
| PIPE_TEMPERATURE | <5 или >80 | <0 или >95 |
| POWER_METER | >configured threshold | >150% threshold |

Пожар (SMOKE_DETECTED) и протечка (WATER_LEAK) — всегда EMERGENCY severity.

---

## API Endpoints

### REST

**Структура здания:**
- `GET /infrastructure/buildings` — список зданий (обычно 1)
- `POST /infrastructure/buildings` — создать
- `GET /infrastructure/buildings/{id}/floors` — этажи здания
- `POST /infrastructure/floors` — создать этаж
- `PATCH /infrastructure/floors/{id}` — обновить (сетка, название)
- `DELETE /infrastructure/floors/{id}`
- `POST /infrastructure/zones` — создать зону
- `PATCH /infrastructure/zones/{id}` — обновить
- `DELETE /infrastructure/zones/{id}`
- `GET /infrastructure/floors/{id}/rooms` — помещения этажа с датчиками
- `POST /infrastructure/rooms` — создать помещение
- `PATCH /infrastructure/rooms/{id}` — обновить (позиция, размер, зона)
- `DELETE /infrastructure/rooms/{id}`

**Датчики:**
- `GET /infrastructure/floors/{id}/sensors` — все датчики этажа с текущими значениями
- `GET /infrastructure/sensors/{id}/readings?hours=24` — история показаний
- `POST /infrastructure/sensors` — зарегистрировать датчик
- `PATCH /infrastructure/sensors/{id}` — обновить
- `DELETE /infrastructure/sensors/{id}`

**Оборудование:**
- `GET /infrastructure/floors/{id}/equipment` — оборудование этажа
- `GET /infrastructure/rooms/{id}/equipment` — оборудование помещения
- `POST /infrastructure/equipment` — создать
- `PATCH /infrastructure/equipment/{id}` — обновить
- `POST /infrastructure/equipment/{id}/command` — отправить команду (вкл/выкл/параметр)
- `GET /infrastructure/equipment/{id}/commands` — история команд

**Алерты:**
- `GET /infrastructure/alerts?status=&severity=&floor_id=&limit=` — список алертов
- `PATCH /infrastructure/alerts/{id}/acknowledge` — подтвердить
- `PATCH /infrastructure/alerts/{id}/resolve` — закрыть

**Автоматизация:**
- `GET /infrastructure/automation/rules` — список правил
- `POST /infrastructure/automation/rules` — создать правило
- `PATCH /infrastructure/automation/rules/{id}` — обновить
- `DELETE /infrastructure/automation/rules/{id}`
- `PATCH /infrastructure/automation/rules/{id}/toggle` — вкл/выкл
- `GET /infrastructure/automation/rules/{id}/logs` — лог срабатываний

**Дашборд:**
- `GET /infrastructure/dashboard` — агрегированные KPI, статусы этажей, топ алерты

### WebSocket

`WS /infrastructure/ws`

Сервер → клиент:
```json
{"type": "sensor_update", "sensor_id": "...", "sensor_type": "TEMPERATURE", "value": 24.5, "unit": "°C", "room_name": "Серверная", "floor": 0, "severity": "NORMAL"}
{"type": "alert", "alert": {"id": "...", "alert_type": "SMOKE_DETECTED", "severity": "EMERGENCY", "title": "Задымление!", "message": "Датчик дыма в серверной (подвал)", "room": "Серверная"}}
{"type": "equipment_update", "equipment_id": "...", "status": "ON", "parameters": {"temperature": 22}}
{"type": "automation_triggered", "rule_name": "Авто-кондиционер", "action": "Кондиционер включён", "room": "Палата 201"}
```

Клиент → сервер:
```json
{"type": "equipment_command", "equipment_id": "...", "command": "TURN_ON"}
{"type": "acknowledge_alert", "alert_id": "..."}
```

---

## Frontend Pages

### Dashboard (`/infrastructure/dashboard`)

1. **KPI карточки** (4 штуки):
   - Всего датчиков / активных
   - Активных алертов (с severity breakdown)
   - Средняя температура здания
   - Потребление энергии (kWh сегодня)

2. **Статус по этажам** — горизонтальные карточки:
   - Номер/название этажа
   - Мини-индикаторы: температура, влажность, CO2
   - Кол-во алертов (бейдж)
   - Зелёный/жёлтый/красный статус

3. **Активные алерты** — список с severity, время, помещение, кнопки действий

4. **Правила автоматизации** — компактный список с toggle вкл/выкл и счётчик срабатываний

### Map (`/infrastructure/map`)

1. **Выбор этажа** — горизонтальные табы

2. **Сетка этажа** — CSS Grid:
   - Помещения как цветные блоки (цвет зоны, opacity по статусу)
   - Иконки датчиков внутри помещений
   - Красная пульсация при CRITICAL/EMERGENCY алерте
   - Hover: tooltip с названием и основными показателями

3. **Боковая панель** (при клике на помещение):
   - Название, тип, зона
   - Все датчики с текущими значениями
   - Оборудование с кнопками управления
   - Мини-графики трендов (recharts sparkline)

4. **Легенда** — иконки датчиков, цвета зон, статусы

### Equipment (`/infrastructure/equipment`)

1. **Фильтры** — по этажу, типу, статусу
2. **Таблица/карточки** оборудования с текущим статусом
3. **Кнопки управления** — вкл/выкл, установить параметр
4. **История команд** — кто, когда, что сделал

### Automation (`/infrastructure/automation`)

1. **Список правил** — карточки с условием, действием, расписанием, toggle
2. **Создание правила** — форма: выбор датчика → оператор → значение → выбор оборудования → команда → расписание
3. **Лог срабатываний** — таблица с временем, значением датчика, действием, статусом

### Settings (`/infrastructure/settings`)

1. **Управление этажами** — CRUD, настройка сетки (cols x rows)
2. **Управление зонами** — CRUD, выбор цвета
3. **Управление помещениями** — CRUD, позиция на сетке (drag или ввод координат)
4. **Управление датчиками** — CRUD, привязка к помещению
5. **Управление оборудованием** — CRUD, привязка к помещению

---

## Mock Data

Здание **"MedCore Clinic"**, 4 этажа:

### Подвал (floor -1, сетка 6x4)
| Помещение | Тип | Датчики | Оборудование |
|-----------|-----|---------|-------------|
| Серверная | SERVER | темп, влажность, дым, движение | кондиционер, UPS |
| Бойлерная | TECHNICAL | темп, темп.трубы, протечка | котёл, насос |
| Электрощитовая | TECHNICAL | темп, счётчик эл-ва | генератор, UPS |
| Склад | STORAGE | темп, влажность, движение, дверь | свет |

### 1 этаж (floor 1, сетка 8x6)
| Помещение | Тип | Датчики | Оборудование |
|-----------|-----|---------|-------------|
| Приёмная | RECEPTION | темп, влажность, CO2, свет | кондиционер, свет |
| Регистратура | OFFICE | темп, CO2, свет | кондиционер, свет |
| Аптека | PHARMACY | темп, влажность | кондиционер, свет |
| Кабинет 1 | OFFICE | темп, CO2 | кондиционер, свет |
| Кабинет 2 | OFFICE | темп, CO2 | кондиционер, свет |
| Коридор 1 | CORRIDOR | движение, свет, дым | свет |
| Туалет | BATHROOM | влажность, протечка | вентиляция, свет |

### 2 этаж (floor 2, сетка 8x6)
| Помещение | Тип | Датчики | Оборудование |
|-----------|-----|---------|-------------|
| Палата 201 | WARD | темп, влажность, CO2, движение | кондиционер, свет |
| Палата 202 | WARD | темп, влажность, CO2, движение | кондиционер, свет |
| Палата 203 | WARD | темп, влажность, CO2 | кондиционер, свет |
| Процедурная | OTHER | темп, влажность | кондиционер, свет |
| Ординаторская | OFFICE | темп, CO2, свет | кондиционер, свет |
| Коридор 2 | CORRIDOR | движение, свет, дым | свет |

### 3 этаж (floor 3, сетка 8x6)
| Помещение | Тип | Датчики | Оборудование |
|-----------|-----|---------|-------------|
| Операционная 1 | OPERATING | темп, влажность, CO2, свет | кондиционер, свет, вентиляция |
| Операционная 2 | OPERATING | темп, влажность, CO2, свет | кондиционер, свет, вентиляция |
| Реанимация | WARD | темп, влажность, CO2, движение | кондиционер, свет |
| Лаборатория | LAB | темп, влажность | кондиционер, свет |
| Стерилизационная | OTHER | темп, влажность | свет |
| Коридор 3 | CORRIDOR | движение, свет, дым | свет |

**Объём данных:**
- ~25 помещений, ~100 датчиков, ~40 единиц оборудования
- 7 дней истории (каждые 5 мин) = ~200K readings
- 30-50 алертов (mix severity и статусов)
- 10 правил автоматизации с историей срабатываний
- 20-30 команд оборудования

---

## Design System

Все компоненты используют существующую дизайн-систему:
- Карточки: `bg-[var(--color-surface)] rounded-2xl border border-border`
- Анимации: `animate-float-up`
- Текст: `text-foreground`, `text-[var(--color-text-secondary)]`, `text-[var(--color-text-tertiary)]`
- Статусы: `text-success`, `text-warning`, `text-destructive`
- EMERGENCY: красный пульсирующий (`animate-pulse bg-destructive/20`)
- Сетка карты: CSS Grid с `gap-1`, помещения с `rounded-lg` и цветом зоны
- Датчики на карте: маленькие круглые иконки (12-16px) с tooltip

---

## Simulator

Фоновый asyncio task (расширение monitoring_simulator или отдельный):
- Обновляет значения всех BMS датчиков каждые 10 секунд
- Random walk с mean reversion для числовых значений
- Редкие события: задымление (0.01%), протечка (0.01%), отключение электричества (0.05%)
- Проверка правил автоматизации при каждом обновлении
- Broadcast через WebSocket
