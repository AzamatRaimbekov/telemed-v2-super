# BMS Dashboard + IoT Building Sensors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Building Management System to the super-admin portal with configurable building structure, interactive floor maps, IoT sensors, equipment control, automation rules, and real-time monitoring via WebSocket.

**Architecture:** Backend: 12 new SQLAlchemy models + Alembic migration + BmsService + REST API (30+ endpoints) + WebSocket + BMS simulator. Frontend: new "Инфраструктура" section in sidebar with 5 pages (dashboard, map, equipment, automation, settings). CSS Grid-based interactive floor map with sensor overlays.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, React 19, TanStack Query/Router, Recharts, CSS Grid, Web Audio API, WebSocket.

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/bms.py` | Building, Floor, Zone, BmsRoom, BmsSensor, BmsSensorReading, Equipment, EquipmentCommand, BmsAlert, AutomationRule, AutomationLog models + enums |
| `backend/app/schemas/bms.py` | Pydantic schemas for all BMS DTOs |
| `backend/app/services/bms.py` | BmsService — CRUD for building structure, sensors, equipment, alerts, automation |
| `backend/app/services/bms_simulator.py` | Background mock data generator for BMS sensors |
| `backend/app/api/v1/routes/infrastructure.py` | REST endpoints + WebSocket for BMS |
| `backend/seed_bms.py` | Seed script: 4-floor building with rooms, sensors, equipment, rules, 7 days history |
| `backend/alembic/versions/xxxx_add_bms_tables.py` | Migration for BMS tables |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Import BMS models |
| `backend/app/api/v1/router.py` | Include infrastructure router |
| `backend/app/main.py` | Start/stop BMS simulator in lifespan |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/features/infrastructure/types.ts` | TypeScript types for BMS domain |
| `frontend/src/features/infrastructure/api.ts` | REST API client for BMS endpoints |
| `frontend/src/features/infrastructure/use-bms-ws.ts` | WebSocket hook for BMS real-time data |
| `frontend/src/features/infrastructure/thresholds.ts` | Sensor thresholds and metadata |
| `frontend/src/routes/_authenticated/infrastructure.tsx` | Layout with sub-navigation for infrastructure pages |
| `frontend/src/routes/_authenticated/infrastructure/dashboard.tsx` | BMS dashboard page |
| `frontend/src/routes/_authenticated/infrastructure/map.tsx` | Interactive floor map page |
| `frontend/src/routes/_authenticated/infrastructure/equipment.tsx` | Equipment management page |
| `frontend/src/routes/_authenticated/infrastructure/automation.tsx` | Automation rules page |
| `frontend/src/routes/_authenticated/infrastructure/settings.tsx` | Building structure settings page |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/routes/_authenticated.tsx` | Add "Инфраструктура" nav item with submenu |

---

## Task 1: Backend Models + Migration

**Files:**
- Create: `backend/app/models/bms.py`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration

- [ ] **Step 1: Create BMS models file**

Create `backend/app/models/bms.py` with all models and enums from the spec:

**Enums:**
- `BmsRoomType`: WARD, CORRIDOR, SERVER, TECHNICAL, OFFICE, OPERATING, LAB, RECEPTION, PHARMACY, STORAGE, BATHROOM, KITCHEN, OTHER
- `BmsSensorType`: TEMPERATURE, HUMIDITY, CO2, LIGHT, SMOKE, WATER_LEAK, MOTION, DOOR_SENSOR, POWER_METER, PIPE_TEMPERATURE
- `EquipmentType`: AC, HEATER, LIGHT, VENTILATION, DOOR_LOCK, ELEVATOR, PUMP, GENERATOR, UPS, OTHER
- `EquipmentStatus`: ON, OFF, ERROR, MAINTENANCE, STANDBY
- `EquipmentCommandType`: TURN_ON, TURN_OFF, SET_PARAMETER, RESTART
- `CommandStatus`: PENDING, EXECUTED, FAILED
- `BmsAlertType`: HIGH_TEMPERATURE, LOW_TEMPERATURE, HIGH_HUMIDITY, LOW_HUMIDITY, HIGH_CO2, SMOKE_DETECTED, WATER_LEAK, POWER_OUTAGE, EQUIPMENT_ERROR, DOOR_FORCED, MOTION_AFTER_HOURS, SENSOR_OFFLINE, PIPE_FREEZE_RISK
- `BmsAlertSeverity`: INFO, WARNING, CRITICAL, EMERGENCY
- `BmsAlertStatus`: ACTIVE, ACKNOWLEDGED, RESOLVED, AUTO_RESOLVED
- `ConditionOperator`: GT, LT, EQ, GTE, LTE

**Models (all TenantMixin, Base except BmsSensorReading and AutomationLog):**
- `Building` — name, address, total_floors, description
- `Floor` — building_id (FK), floor_number, name, grid_cols (default 8), grid_rows (default 6), sort_order
- `Zone` — floor_id (FK), name, color
- `BmsRoom` — floor_id (FK), zone_id (FK nullable), name, room_type (enum), grid_x, grid_y, grid_w (default 1), grid_h (default 1), linked_room_id (FK rooms nullable)
- `BmsSensor` — bms_room_id (FK), floor_id (FK), sensor_type (enum), name, serial_number nullable, is_active, last_value nullable, last_value_text nullable, last_reading_at nullable, grid_x_offset (float default 0.5), grid_y_offset (float default 0.5)
- `BmsSensorReading` — (Base only, no TenantMixin) id (UUID pk), sensor_id (FK), value (float nullable), value_text nullable, unit, recorded_at. Index on (sensor_id, recorded_at)
- `Equipment` — bms_room_id (FK), equipment_type (enum), name, model nullable, status (enum default OFF), parameters (JSON nullable), is_controllable (default True), last_status_change nullable
- `EquipmentCommand` — equipment_id (FK), command (enum), parameters (JSON nullable), issued_by_id (FK users), issued_at, status (enum default PENDING), executed_at nullable, error_message nullable
- `BmsAlert` — floor_id (FK nullable), bms_room_id (FK nullable), sensor_id (FK nullable), equipment_id (FK nullable), alert_type (enum), severity (enum), title, message (Text), status (enum default ACTIVE), acknowledged_by_id (FK users nullable), acknowledged_at nullable, resolved_by_id nullable, resolved_at nullable
- `AutomationRule` — name, description nullable, is_active (default True), condition_sensor_type, condition_operator (enum), condition_value (float), condition_floor_id (FK nullable), condition_room_id (FK nullable), action_equipment_type nullable, action_equipment_id (FK nullable), action_command, action_parameters (JSON nullable), schedule_cron nullable, schedule_description nullable, last_triggered_at nullable, trigger_count (int default 0)
- `AutomationLog` — (Base only) id (UUID pk), rule_id (FK), triggered_at, sensor_value (float nullable), action_taken, success (bool), error_message nullable

Follow existing patterns from `backend/app/models/monitoring.py` for structure. Use `lazy="selectin"` for relationships.

- [ ] **Step 2: Register models in `__init__.py`**

Add imports and `__all__` entries for all 12 models.

- [ ] **Step 3: Generate and run migration**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
python -m alembic revision --autogenerate -m "add bms tables"
python -m alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/bms.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(bms): add models — building, floors, rooms, sensors, equipment, automation"
```

---

## Task 2: Backend Schemas

**Files:**
- Create: `backend/app/schemas/bms.py`

- [ ] **Step 1: Create Pydantic schemas**

Create schemas for all BMS DTOs. Follow patterns from `backend/app/schemas/monitoring.py`:

**Building:** BuildingCreate (name, address, total_floors), BuildingOut
**Floor:** FloorCreate (building_id, floor_number, name, grid_cols, grid_rows), FloorUpdate, FloorOut
**Zone:** ZoneCreate (floor_id, name, color), ZoneUpdate, ZoneOut
**BmsRoom:** BmsRoomCreate (floor_id, zone_id, name, room_type, grid_x, grid_y, grid_w, grid_h), BmsRoomUpdate, BmsRoomOut
**BmsSensor:** BmsSensorCreate (bms_room_id, floor_id, sensor_type, name), BmsSensorUpdate, BmsSensorOut, BmsSensorCurrentReading
**Equipment:** EquipmentCreate, EquipmentUpdate, EquipmentOut
**EquipmentCommand:** EquipmentCommandCreate (command, parameters), EquipmentCommandOut
**BmsAlert:** BmsAlertOut
**AutomationRule:** AutomationRuleCreate, AutomationRuleUpdate, AutomationRuleOut
**AutomationLog:** AutomationLogOut
**Dashboard:** BmsDashboardOut (sensor_count, active_alerts, avg_temperature, energy_consumption, floor_statuses)

All Out schemas: `model_config = {"from_attributes": True}`

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/bms.py
git commit -m "feat(bms): add Pydantic schemas"
```

---

## Task 3: Backend Service

**Files:**
- Create: `backend/app/services/bms.py`

- [ ] **Step 1: Create BmsService**

Create `backend/app/services/bms.py` with `BmsService(session)`. Follow patterns from `backend/app/services/monitoring.py`.

**Thresholds dict** (BMS_THRESHOLDS):
- TEMPERATURE: WARNING (18, 28), CRITICAL (15, 32)
- HUMIDITY: WARNING (30, 70), CRITICAL (20, 80)
- CO2: WARNING (None, 1000), CRITICAL (None, 1500)
- LIGHT: WARNING (100, 800), CRITICAL (50, 1000)
- PIPE_TEMPERATURE: WARNING (5, 80), CRITICAL (0, 95)
- SMOKE: always EMERGENCY on detected
- WATER_LEAK: always EMERGENCY on detected

**`evaluate_bms_severity(sensor_type, value, value_text)`** — returns NORMAL/WARNING/CRITICAL/EMERGENCY.

**Methods:**

Building structure CRUD:
- `get_buildings(clinic_id)`, `create_building(clinic_id, data)`, `update_building(id, clinic_id, data)`
- `get_floors(building_id, clinic_id)`, `create_floor(clinic_id, data)`, `update_floor(id, clinic_id, data)`, `delete_floor(id, clinic_id)`
- `get_zones(floor_id, clinic_id)`, `create_zone(clinic_id, data)`, `update_zone(id, clinic_id, data)`, `delete_zone(id, clinic_id)`
- `get_rooms(floor_id, clinic_id)` — returns rooms with sensors and equipment eagerly loaded
- `create_room(clinic_id, data)`, `update_room(id, clinic_id, data)`, `delete_room(id, clinic_id)`

Sensors:
- `get_floor_sensors(floor_id, clinic_id)` — all sensors for a floor with current values
- `get_sensor_readings(sensor_id, from_dt, to_dt)` — time-range readings
- `create_sensor(clinic_id, data)`, `update_sensor(id, clinic_id, data)`, `delete_sensor(id, clinic_id)`

Equipment:
- `get_floor_equipment(floor_id, clinic_id)`, `get_room_equipment(room_id, clinic_id)`
- `create_equipment(clinic_id, data)`, `update_equipment(id, clinic_id, data)`
- `send_command(equipment_id, clinic_id, user_id, command, parameters)` — creates EquipmentCommand, updates Equipment status/parameters, returns command
- `get_equipment_commands(equipment_id, limit)`

Alerts:
- `get_alerts(clinic_id, status, severity, floor_id, limit)`, `acknowledge_alert(id, clinic_id, user_id)`, `resolve_alert(id, clinic_id, user_id)`
- `create_alert(clinic_id, ...)` — internal, called by simulator

Automation:
- `get_rules(clinic_id)`, `create_rule(clinic_id, data)`, `update_rule(id, clinic_id, data)`, `delete_rule(id, clinic_id)`, `toggle_rule(id, clinic_id)`
- `get_rule_logs(rule_id, limit)`
- `evaluate_rules(clinic_id, sensor_type, value, floor_id, room_id)` — checks all active rules against a sensor reading, executes matching actions, logs results

Dashboard:
- `get_dashboard(clinic_id)` — aggregates: total sensors, active alerts count by severity, avg temperature, total energy (from POWER_METER readings today), floor statuses (list of floors with worst severity)

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/bms.py
git commit -m "feat(bms): add BmsService with CRUD, thresholds, automation engine"
```

---

## Task 4: Backend REST API + WebSocket

**Files:**
- Create: `backend/app/api/v1/routes/infrastructure.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create infrastructure routes**

Create `backend/app/api/v1/routes/infrastructure.py` with `router = APIRouter(prefix="/infrastructure", tags=["Infrastructure BMS"])`.

**WebSocket ConnectionManager** — same pattern as monitoring, keyed by `clinic_id` instead of `patient_id`.

**WS endpoint:** `@router.websocket("/ws")` — auth via `?token=`, broadcast sensor updates, alerts, equipment changes, automation triggers.

**REST endpoints (all require CurrentUser):**

Buildings:
- `GET /infrastructure/buildings`
- `POST /infrastructure/buildings`

Floors:
- `GET /infrastructure/buildings/{building_id}/floors`
- `POST /infrastructure/floors`
- `PATCH /infrastructure/floors/{floor_id}`
- `DELETE /infrastructure/floors/{floor_id}`

Zones:
- `POST /infrastructure/zones`
- `PATCH /infrastructure/zones/{zone_id}`
- `DELETE /infrastructure/zones/{zone_id}`

Rooms:
- `GET /infrastructure/floors/{floor_id}/rooms`
- `POST /infrastructure/rooms`
- `PATCH /infrastructure/rooms/{room_id}`
- `DELETE /infrastructure/rooms/{room_id}`

Sensors:
- `GET /infrastructure/floors/{floor_id}/sensors`
- `GET /infrastructure/sensors/{sensor_id}/readings?hours=24`
- `POST /infrastructure/sensors`
- `PATCH /infrastructure/sensors/{sensor_id}`
- `DELETE /infrastructure/sensors/{sensor_id}`

Equipment:
- `GET /infrastructure/floors/{floor_id}/equipment`
- `GET /infrastructure/rooms/{room_id}/equipment`
- `POST /infrastructure/equipment`
- `PATCH /infrastructure/equipment/{equipment_id}`
- `POST /infrastructure/equipment/{equipment_id}/command`
- `GET /infrastructure/equipment/{equipment_id}/commands`

Alerts:
- `GET /infrastructure/alerts?status=&severity=&floor_id=&limit=50`
- `PATCH /infrastructure/alerts/{alert_id}/acknowledge`
- `PATCH /infrastructure/alerts/{alert_id}/resolve`

Automation:
- `GET /infrastructure/automation/rules`
- `POST /infrastructure/automation/rules`
- `PATCH /infrastructure/automation/rules/{rule_id}`
- `DELETE /infrastructure/automation/rules/{rule_id}`
- `PATCH /infrastructure/automation/rules/{rule_id}/toggle`
- `GET /infrastructure/automation/rules/{rule_id}/logs`

Dashboard:
- `GET /infrastructure/dashboard`

Each endpoint: instantiate `BmsService(session)`, call service method, serialize response as dict.

- [ ] **Step 2: Register router**

Add to `backend/app/api/v1/router.py`:
- Import: `from app.api.v1.routes import ..., infrastructure`
- Include: `api_router.include_router(infrastructure.router)`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/infrastructure.py backend/app/api/v1/router.py
git commit -m "feat(bms): add REST API + WebSocket for infrastructure"
```

---

## Task 5: Backend BMS Simulator

**Files:**
- Create: `backend/app/services/bms_simulator.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create BMS simulator**

Create `backend/app/services/bms_simulator.py` — background asyncio task similar to `monitoring_simulator.py`.

`start_bms_simulator()` / `stop_bms_simulator()` functions.

Every 10 seconds:
- Read all active BmsSensors
- Generate realistic values using random walk with mean reversion (same pattern as monitoring simulator)
- SMOKE: 0.01% chance of detection, WATER_LEAK: 0.01% chance, POWER_METER: random walk around 50 kWh
- Write BmsSensorReading, update sensor.last_value/last_reading_at
- Evaluate severity, create BmsAlerts for WARNING/CRITICAL/EMERGENCY
- Call `evaluate_rules()` for automation rule checking
- Broadcast via WS manager

- [ ] **Step 2: Integrate into app lifespan**

In `backend/app/main.py`, add:
```python
from app.services.bms_simulator import start_bms_simulator, stop_bms_simulator
```
Call `start_bms_simulator()` before yield, `stop_bms_simulator()` after yield.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/bms_simulator.py backend/app/main.py
git commit -m "feat(bms): add BMS sensor simulator with automation evaluation"
```

---

## Task 6: Backend Seed Script

**Files:**
- Create: `backend/seed_bms.py`

- [ ] **Step 1: Create seed script**

Create `backend/seed_bms.py` that seeds the full 4-floor building from the spec.

Must create:
- 1 Building "MedCore Clinic"
- 4 Floors (Подвал, 1-3 этажи) with grid sizes
- Zones per floor (e.g. "Серверный блок", "Левое крыло", "Правое крыло")
- ~25 BmsRooms with grid positions (x, y, w, h) as specified in the spec mock data section
- ~100 BmsSensors (3-8 per room) with types matching the spec table
- ~40 Equipment items with types and initial statuses
- 7 days of BmsSensorReadings (every 5 min) — use `_gen_bms_reading(sensor_type)` helper
- 30-50 BmsAlerts with mix of severities and statuses
- 10 AutomationRules with sample conditions/actions (e.g. "If TEMPERATURE > 26 in any WARD → TURN_ON AC")
- 20-30 AutomationLogs for those rules
- 20-30 EquipmentCommands history

Run with: `python seed_bms.py`

- [ ] **Step 2: Commit**

```bash
git add backend/seed_bms.py
git commit -m "feat(bms): add seed script for 4-floor building with full mock data"
```

---

## Task 7: Frontend Types + API + Thresholds + WS Hook

**Files:**
- Create: `frontend/src/features/infrastructure/types.ts`
- Create: `frontend/src/features/infrastructure/api.ts`
- Create: `frontend/src/features/infrastructure/thresholds.ts`
- Create: `frontend/src/features/infrastructure/use-bms-ws.ts`

- [ ] **Step 1: Create types**

TypeScript types matching all backend models. Include: Building, Floor, Zone, BmsRoom, BmsSensor, BmsSensorReading, Equipment, EquipmentCommand, BmsAlert, AutomationRule, AutomationLog, BmsDashboard, FloorStatus. Plus all enum-like union types.

WsMessage discriminated union: sensor_update, alert, equipment_update, automation_triggered.

- [ ] **Step 2: Create thresholds**

BMS_SENSOR_META: Record mapping sensor type to {label (Russian), unit, icon, format function, color classes}. Similar pattern to `features/monitoring/thresholds.ts`.

Equipment type labels and status labels in Russian.

- [ ] **Step 3: Create API client**

`infrastructureApi` object with all REST methods matching the backend endpoints. Follow pattern from `features/monitoring/api.ts`.

- [ ] **Step 4: Create WebSocket hook**

`useBmsWS()` hook — connects to `/api/v1/infrastructure/ws?token=...`, handles sensor_update (update React Query cache), alert (toast + sound), equipment_update (invalidate queries), automation_triggered (toast info). Auto-reconnect on close.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/infrastructure/
git commit -m "feat(bms): add frontend types, API client, thresholds, WebSocket hook"
```

---

## Task 8: Frontend Navigation + Layout

**Files:**
- Modify: `frontend/src/routes/_authenticated.tsx`
- Create: `frontend/src/routes/_authenticated/infrastructure.tsx`

- [ ] **Step 1: Add "Инфраструктура" to sidebar**

In `_authenticated.tsx`, add a new nav item after "Аналитика" in the `navItems` array:

```typescript
{
  label: "Инфраструктура",
  to: "/infrastructure/dashboard" as const,
  icon: (/* Building SVG icon */),
},
```

Use a building/server SVG icon (e.g. Lucide "Building2" path).

- [ ] **Step 2: Create infrastructure layout**

Create `frontend/src/routes/_authenticated/infrastructure.tsx`:

```typescript
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/infrastructure")({
  component: InfrastructureLayout,
});

const SUB_TABS = [
  { path: "dashboard", label: "Дашборд" },
  { path: "map", label: "Карта здания" },
  { path: "equipment", label: "Оборудование" },
  { path: "automation", label: "Автоматизация" },
  { path: "settings", label: "Настройки" },
];

function InfrastructureLayout() {
  // Horizontal sub-navigation tabs, similar to patient detail tabs
  // Render SUB_TABS as Links
  // Render <Outlet /> below
}
```

Style the sub-navigation using the same pattern as patient detail tabs (horizontal scrollable pills).

- [ ] **Step 3: Create index redirect**

Create `frontend/src/routes/_authenticated/infrastructure/index.tsx` that redirects to `/infrastructure/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated.tsx frontend/src/routes/_authenticated/infrastructure.tsx frontend/src/routes/_authenticated/infrastructure/index.tsx
git commit -m "feat(bms): add infrastructure navigation and layout"
```

---

## Task 9: Frontend Dashboard Page

**Files:**
- Create: `frontend/src/routes/_authenticated/infrastructure/dashboard.tsx`

- [ ] **Step 1: Create dashboard page**

Full page with 4 sections:

**1. KPI Cards** (4 cards in grid):
- Всего датчиков / активных — with sensor icon
- Активных алертов — with severity breakdown (badges)
- Средняя температура здания — with thermometer icon
- Потребление энергии (kWh) — with bolt icon

Query: `infrastructureApi.getDashboard()`

**2. Floor Status Cards** — horizontal cards per floor:
- Floor name + number
- Mini indicators: avg temp, humidity, CO2
- Alert count badge (colored by worst severity)
- Overall status dot (green/yellow/red)

**3. Active Alerts** — list of active alerts:
- Time, severity badge, title, room name, floor
- "Подтвердить" / "Закрыть" buttons
- Filter by severity

**4. Automation Rules** — compact list:
- Rule name, condition description, action description
- Toggle switch (active/disabled)
- Trigger count badge
- Last triggered time

Use `useBmsWS()` for real-time updates. Follow design system: `bg-[var(--color-surface)] rounded-2xl border border-border`, `animate-float-up`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/infrastructure/dashboard.tsx
git commit -m "feat(bms): add BMS dashboard page with KPIs, floor status, alerts, automation"
```

---

## Task 10: Frontend Floor Map Page

**Files:**
- Create: `frontend/src/routes/_authenticated/infrastructure/map.tsx`

- [ ] **Step 1: Create floor map page**

The most complex frontend page. Sections:

**1. Floor Selector** — horizontal tab buttons for each floor.

**2. Floor Grid** — CSS Grid based on floor's `grid_cols` x `grid_rows`:
- Each BmsRoom rendered as a colored div spanning `grid_w` x `grid_h` cells
- Color from zone.color with opacity based on status (normal=0.3, warning=0.5, critical=0.7, emergency=pulsing)
- Room name centered in the block
- Sensor icons (small colored dots 12px) positioned inside rooms using absolute positioning with grid_x_offset/grid_y_offset
- Sensor dot color: green=normal, yellow=warning, red=critical, pulsing red=emergency
- Hover on room: tooltip with name + key readings
- Click on room: opens side panel

**3. Side Panel** (slide-in from right, 400px wide):
- Room name, type badge, zone badge
- All sensors with current values and severity colors
- Equipment list with status badges and control buttons (ON/OFF toggle, parameter sliders)
- Mini sparkline charts per sensor (last 1 hour, using recharts AreaChart)
- Close button

**4. Legend** — fixed at bottom: sensor type icons, zone colors, status meanings

Queries:
- `infrastructureApi.getFloors(buildingId)` for floor tabs
- `infrastructureApi.getRooms(floorId)` for rooms with sensors
- `infrastructureApi.getFloorSensors(floorId)` for current readings
- `infrastructureApi.getFloorEquipment(floorId)` for equipment
- `infrastructureApi.getSensorReadings(sensorId, 1)` for sparklines (1 hour)

State: `selectedFloor`, `selectedRoom` (for side panel), sensor readings updated via WS.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/infrastructure/map.tsx
git commit -m "feat(bms): add interactive floor map with room details and sensor overlays"
```

---

## Task 11: Frontend Equipment Page

**Files:**
- Create: `frontend/src/routes/_authenticated/infrastructure/equipment.tsx`

- [ ] **Step 1: Create equipment page**

Sections:

**1. Filters** — dropdowns for floor, equipment type, status.

**2. Equipment Grid** — cards or table:
- Equipment name, type badge, room name, floor
- Status badge (ON=green, OFF=gray, ERROR=red, MAINTENANCE=yellow, STANDBY=blue)
- Control buttons: "Вкл"/"Выкл" toggle, "Параметры" button (opens modal)
- Parameters display: JSON rendered as key-value pairs

**3. Parameter Modal** — for SET_PARAMETER command:
- Temperature slider (16-30°C for AC)
- Brightness slider (0-100% for LIGHT)
- Generic JSON editor fallback
- "Отправить" button → mutation `sendCommand`

**4. Command History** — expandable per equipment:
- Time, command type, parameters, status badge, issued by name

Mutations: `sendCommand(equipmentId, {command, parameters})`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/infrastructure/equipment.tsx
git commit -m "feat(bms): add equipment management page with controls and command history"
```

---

## Task 12: Frontend Automation Page

**Files:**
- Create: `frontend/src/routes/_authenticated/infrastructure/automation.tsx`

- [ ] **Step 1: Create automation page**

Sections:

**1. Rules List** — cards:
- Rule name, description
- Condition: "Если [sensor_type] [operator] [value] в [room/floor/всё здание]"
- Action: "[command] [equipment_type/name]" + parameters
- Schedule: cron description or "Всегда"
- Toggle switch (active/disabled)
- Trigger count + last triggered time
- Edit/Delete buttons

**2. Create/Edit Rule Form** — modal or inline:
- Name input
- Condition: sensor type dropdown → operator dropdown → value input
- Scope: floor dropdown (optional) → room dropdown (optional)
- Action: equipment type dropdown → command dropdown → parameters
- Schedule: cron input with description helper (presets: "Всегда", "Рабочие дни 8-20", "Ночь 22-6", custom)
- Save/Cancel

**3. Trigger Log** — expandable per rule:
- Triggered at, sensor value at trigger, action taken, success/fail badge

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/infrastructure/automation.tsx
git commit -m "feat(bms): add automation rules page with rule builder and trigger logs"
```

---

## Task 13: Frontend Settings Page

**Files:**
- Create: `frontend/src/routes/_authenticated/infrastructure/settings.tsx`

- [ ] **Step 1: Create settings page**

Tabs: Этажи | Зоны | Помещения | Датчики | Оборудование

Each tab: table/list with CRUD operations.

**Этажи tab:**
- List of floors with number, name, grid size
- Create: floor_number, name, grid_cols, grid_rows
- Edit inline or modal
- Delete with confirmation

**Зоны tab:**
- List of zones grouped by floor
- Create: floor, name, color picker
- Color picker: 8 preset colors + custom hex input

**Помещения tab:**
- List grouped by floor
- Create: floor, zone, name, type, grid position (x, y, w, h)
- Grid position inputs with validation (within floor bounds)

**Датчики tab:**
- List grouped by room
- Create: room, sensor_type, name
- Toggle active/inactive

**Оборудование tab:**
- List grouped by room
- Create: room, type, name, model, is_controllable
- Edit status dropdown

All CRUD operations use mutations with toast success/error.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/infrastructure/settings.tsx
git commit -m "feat(bms): add infrastructure settings page with full CRUD for building structure"
```

---

## Task 14: Seed Data + Local Testing

**Files:** None new, run existing scripts

- [ ] **Step 1: Run seed locally**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
python seed_bms.py
```

- [ ] **Step 2: Start backend and verify API**

```bash
uvicorn app.main:app --reload --port 8000
```

Test endpoints:
```bash
curl http://localhost:8000/api/v1/infrastructure/dashboard
curl http://localhost:8000/api/v1/infrastructure/buildings
```

- [ ] **Step 3: Start frontend and test UI**

Navigate to `/infrastructure/dashboard`, verify all pages load with data.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(bms): address integration issues"
```

---

## Task 15: Deploy

- [ ] **Step 1: Push to GitHub** (if connected) or deploy via Railway CLI

- [ ] **Step 2: Run seed on production**

```bash
railway service Backend
railway run -- python3 seed_bms.py
```

- [ ] **Step 3: Verify on production**

Open infrastructure dashboard and map pages, confirm data loads.
