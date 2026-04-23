---
aliases: [BMS, Building Management, Инфраструктура]
tags: [feature, bms, iot, infrastructure]
created: 2026-04-20
---

# Управление зданием (BMS)

Building Management System — IoT управление зданием клиники.

## Иерархия

```
Building → Floor → Zone → BmsRoom
                            ├── BmsSensor → BmsSensorReading
                            └── Equipment → EquipmentCommand
```

## Типы помещений

WARD, CORRIDOR, OPERATING, LAB, PHARMACY, RECEPTION, OFFICE, SERVER_ROOM, STORAGE, ELEVATOR, STAIRCASE, PARKING

## Типы датчиков BMS

| Тип | Описание |
|-----|----------|
| TEMPERATURE | Температура воздуха |
| HUMIDITY | Влажность |
| CO2 | Уровень CO2 |
| LIGHT | Освещённость |
| SMOKE | Датчик дыма |
| WATER_LEAK | Утечка воды |
| MOTION | Движение |
| DOOR | Состояние двери |
| POWER_METER | Энергопотребление |
| AIR_QUALITY | Качество воздуха |

## Типы оборудования

| Тип | Управление |
|-----|-----------|
| AC | Кондиционер (вкл/выкл, температура) |
| HEATER | Обогреватель |
| LIGHT | Освещение (вкл/выкл, яркость) |
| VENTILATION | Вентиляция |
| DOOR_LOCK | Замок двери (открыть/закрыть) |
| ELEVATOR | Лифт |
| FIRE_SUPPRESSION | Пожаротушение |
| GENERATOR | Генератор |
| UPS | ИБП |
| WATER_PUMP | Насос |

## Автоматизация

**AutomationRule** — правила автоматического управления:
- По расписанию (CRON)
- По условию (температура > 25° → включить AC)
- По событию (дым → пожаротушение)

**AutomationLog** — журнал выполнения правил

## Backend

- **Модели:** `backend/app/models/bms.py` (13KB)
- **Сервис:** `backend/app/services/bms.py` (34KB)
- **Симулятор:** `backend/app/services/bms_simulator.py` (10KB)
- **Маршрут:** `backend/app/api/v1/routes/infrastructure.py` (23KB)
- **Seed:** `backend/seed_bms.py` (31KB)

## Frontend

- **API:** `frontend/src/features/infrastructure/api.ts`
- **WebSocket хук:** `frontend/src/features/infrastructure/use-bms-ws.ts`
- **Типы:** `frontend/src/features/infrastructure/types.ts`
- **Пороги:** `frontend/src/features/infrastructure/thresholds.ts`
- **Маршруты:** `frontend/src/routes/_authenticated/infrastructure/` (8 подроутов)

## Связанные документы

- [[Мониторинг пациентов]]
- [[Модели базы данных]]
