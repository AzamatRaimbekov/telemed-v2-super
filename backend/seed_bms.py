"""Seed BMS data: 4-floor building with rooms, sensors, equipment, 7 days of readings,
alerts, automation rules, automation logs, and equipment commands."""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.clinic import Clinic
from app.models.user import User
from app.models.bms import (
    Building, Floor, Zone, BmsRoom, BmsSensor, BmsSensorReading,
    Equipment, EquipmentCommand, BmsAlert, AutomationRule, AutomationLog,
    BmsRoomType, BmsSensorType, EquipmentType, EquipmentStatus,
    EquipmentCommandType, CommandStatus,
    BmsAlertType, BmsAlertSeverity, BmsAlertStatus,
    ConditionOperator,
)


# ── Reading generator ────────────────────────────────────────────────────────

def _gen_bms_reading(sensor_type: str) -> tuple[float | None, str | None, str]:
    """Generate a single realistic reading for a BMS sensor type."""
    if sensor_type == "TEMPERATURE":
        return (round(random.gauss(22, 1), 1), None, "°C")
    if sensor_type == "HUMIDITY":
        return (round(random.gauss(50, 5), 0), None, "%")
    if sensor_type == "CO2":
        return (round(random.gauss(600, 80), 0), None, "ppm")
    if sensor_type == "LIGHT":
        return (round(random.gauss(400, 50), 0), None, "lux")
    if sensor_type == "SMOKE":
        return (0.0, "NORMAL", "bool")
    if sensor_type == "WATER_LEAK":
        return (0.0, "NORMAL", "bool")
    if sensor_type == "MOTION":
        active = random.random() < 0.5
        return (1.0 if active else 0.0, "MOTION" if active else "NO_MOTION", "bool")
    if sensor_type == "DOOR_SENSOR":
        is_open = random.random() < 0.05
        return (1.0 if is_open else 0.0, "OPEN" if is_open else "CLOSED", "bool")
    if sensor_type == "POWER_METER":
        return (round(random.gauss(50, 5), 1), None, "kWh")
    if sensor_type == "PIPE_TEMPERATURE":
        return (round(random.gauss(60, 3), 1), None, "°C")
    return (0.0, None, "")


# ── Sensor name mapping ─────────────────────────────────────────────────────

SENSOR_NAMES = {
    "TEMPERATURE": "Термометр",
    "HUMIDITY": "Гигрометр",
    "CO2": "Датчик CO2",
    "LIGHT": "Датчик освещённости",
    "SMOKE": "Датчик дыма",
    "WATER_LEAK": "Датчик протечки",
    "MOTION": "Датчик движения",
    "DOOR_SENSOR": "Датчик двери",
    "POWER_METER": "Электросчётчик",
    "PIPE_TEMPERATURE": "Термометр трубы",
}

EQUIP_NAMES = {
    "AC": "Кондиционер",
    "LIGHT": "Освещение",
    "VENTILATION": "Вентиляция",
    "UPS": "ИБП",
    "GENERATOR": "Генератор",
    "OTHER": "Оборудование",
    "PUMP": "Насос",
}


# ── Floor definitions ────────────────────────────────────────────────────────

FLOORS = [
    {
        "number": -1, "name": "Подвал", "grid_cols": 6, "grid_rows": 4, "sort_order": 0,
        "zones": [
            {"name": "Техническая зона", "color": "#6B7280"},
            {"name": "Складская зона", "color": "#9CA3AF"},
        ],
        "rooms": [
            {
                "name": "Серверная", "type": "SERVER", "x": 0, "y": 0, "w": 2, "h": 2, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "SMOKE", "MOTION"],
                "equipment": [("AC", "Кондиционер серверной"), ("UPS", "ИБП серверной")],
            },
            {
                "name": "Бойлерная", "type": "TECHNICAL", "x": 2, "y": 0, "w": 2, "h": 2, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "PIPE_TEMPERATURE", "WATER_LEAK"],
                "equipment": [("OTHER", "Котёл"), ("PUMP", "Насос")],
            },
            {
                "name": "Электрощитовая", "type": "TECHNICAL", "x": 4, "y": 0, "w": 2, "h": 2, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "POWER_METER"],
                "equipment": [("GENERATOR", "Генератор"), ("UPS", "ИБП")],
            },
            {
                "name": "Склад", "type": "STORAGE", "x": 0, "y": 2, "w": 3, "h": 2, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "HUMIDITY", "MOTION", "DOOR_SENSOR"],
                "equipment": [("LIGHT", "Свет склада")],
            },
        ],
    },
    {
        "number": 1, "name": "1 этаж", "grid_cols": 8, "grid_rows": 6, "sort_order": 1,
        "zones": [
            {"name": "Зона приёма", "color": "#3B82F6"},
            {"name": "Кабинеты", "color": "#10B981"},
            {"name": "Служебная зона", "color": "#F59E0B"},
        ],
        "rooms": [
            {
                "name": "Приёмная", "type": "RECEPTION", "x": 0, "y": 0, "w": 3, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "LIGHT"],
                "equipment": [("AC", "Кондиционер приёмной"), ("LIGHT", "Свет приёмной")],
            },
            {
                "name": "Регистратура", "type": "OFFICE", "x": 3, "y": 0, "w": 2, "h": 2, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "CO2", "LIGHT"],
                "equipment": [("AC", "Кондиционер регистратуры"), ("LIGHT", "Свет регистратуры")],
            },
            {
                "name": "Аптека", "type": "PHARMACY", "x": 5, "y": 0, "w": 3, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY"],
                "equipment": [("AC", "Кондиционер аптеки"), ("LIGHT", "Свет аптеки")],
            },
            {
                "name": "Кабинет 1", "type": "OFFICE", "x": 0, "y": 3, "w": 2, "h": 3, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "CO2"],
                "equipment": [("AC", "Кондиционер каб. 1"), ("LIGHT", "Свет каб. 1")],
            },
            {
                "name": "Кабинет 2", "type": "OFFICE", "x": 2, "y": 3, "w": 2, "h": 3, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "CO2"],
                "equipment": [("AC", "Кондиционер каб. 2"), ("LIGHT", "Свет каб. 2")],
            },
            {
                "name": "Коридор 1", "type": "CORRIDOR", "x": 4, "y": 3, "w": 3, "h": 1, "zone_idx": 2,
                "sensors": ["MOTION", "LIGHT", "SMOKE"],
                "equipment": [("LIGHT", "Свет коридора 1")],
            },
            {
                "name": "Туалет", "type": "BATHROOM", "x": 4, "y": 4, "w": 2, "h": 2, "zone_idx": 2,
                "sensors": ["HUMIDITY", "WATER_LEAK"],
                "equipment": [("VENTILATION", "Вентиляция туалета"), ("LIGHT", "Свет туалета")],
            },
        ],
    },
    {
        "number": 2, "name": "2 этаж", "grid_cols": 8, "grid_rows": 6, "sort_order": 2,
        "zones": [
            {"name": "Палатная зона", "color": "#8B5CF6"},
            {"name": "Служебная зона", "color": "#EF4444"},
        ],
        "rooms": [
            {
                "name": "Палата 201", "type": "WARD", "x": 0, "y": 0, "w": 2, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "MOTION"],
                "equipment": [("AC", "Кондиционер п. 201"), ("LIGHT", "Свет п. 201")],
            },
            {
                "name": "Палата 202", "type": "WARD", "x": 2, "y": 0, "w": 2, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "MOTION"],
                "equipment": [("AC", "Кондиционер п. 202"), ("LIGHT", "Свет п. 202")],
            },
            {
                "name": "Палата 203", "type": "WARD", "x": 4, "y": 0, "w": 2, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2"],
                "equipment": [("AC", "Кондиционер п. 203"), ("LIGHT", "Свет п. 203")],
            },
            {
                "name": "Процедурная", "type": "OTHER", "x": 6, "y": 0, "w": 2, "h": 3, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "HUMIDITY"],
                "equipment": [("AC", "Кондиционер процедурной"), ("LIGHT", "Свет процедурной")],
            },
            {
                "name": "Ординаторская", "type": "OFFICE", "x": 0, "y": 3, "w": 3, "h": 3, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "CO2", "LIGHT"],
                "equipment": [("AC", "Кондиционер ординаторской"), ("LIGHT", "Свет ординаторской")],
            },
            {
                "name": "Коридор 2", "type": "CORRIDOR", "x": 3, "y": 3, "w": 5, "h": 1, "zone_idx": 1,
                "sensors": ["MOTION", "LIGHT", "SMOKE"],
                "equipment": [("LIGHT", "Свет коридора 2")],
            },
        ],
    },
    {
        "number": 3, "name": "3 этаж", "grid_cols": 8, "grid_rows": 6, "sort_order": 3,
        "zones": [
            {"name": "Операционный блок", "color": "#DC2626"},
            {"name": "Лабораторный блок", "color": "#059669"},
            {"name": "Служебная зона", "color": "#D97706"},
        ],
        "rooms": [
            {
                "name": "Операционная 1", "type": "OPERATING", "x": 0, "y": 0, "w": 3, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "LIGHT"],
                "equipment": [("AC", "Кондиционер ОП 1"), ("LIGHT", "Свет ОП 1"), ("VENTILATION", "Вентиляция ОП 1")],
            },
            {
                "name": "Операционная 2", "type": "OPERATING", "x": 3, "y": 0, "w": 3, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "LIGHT"],
                "equipment": [("AC", "Кондиционер ОП 2"), ("LIGHT", "Свет ОП 2"), ("VENTILATION", "Вентиляция ОП 2")],
            },
            {
                "name": "Реанимация", "type": "WARD", "x": 6, "y": 0, "w": 2, "h": 3, "zone_idx": 0,
                "sensors": ["TEMPERATURE", "HUMIDITY", "CO2", "MOTION"],
                "equipment": [("AC", "Кондиционер реанимации"), ("LIGHT", "Свет реанимации")],
            },
            {
                "name": "Лаборатория", "type": "LAB", "x": 0, "y": 3, "w": 3, "h": 3, "zone_idx": 1,
                "sensors": ["TEMPERATURE", "HUMIDITY"],
                "equipment": [("AC", "Кондиционер лаборатории"), ("LIGHT", "Свет лаборатории")],
            },
            {
                "name": "Стерилизационная", "type": "OTHER", "x": 3, "y": 3, "w": 2, "h": 3, "zone_idx": 2,
                "sensors": ["TEMPERATURE", "HUMIDITY"],
                "equipment": [("LIGHT", "Свет стерилизационной")],
            },
            {
                "name": "Коридор 3", "type": "CORRIDOR", "x": 5, "y": 3, "w": 3, "h": 1, "zone_idx": 2,
                "sensors": ["MOTION", "LIGHT", "SMOKE"],
                "equipment": [("LIGHT", "Свет коридора 3")],
            },
        ],
    },
]


# ── Automation rules definitions ─────────────────────────────────────────────

RULES_DEFS = [
    {
        "name": "Авто-кондиционер палат",
        "description": "Включить кондиционер при температуре выше 26°C в палатах",
        "condition_sensor_type": "TEMPERATURE",
        "condition_operator": "GT",
        "condition_value": 26.0,
        "action_equipment_type": "AC",
        "action_command": "TURN_ON",
    },
    {
        "name": "Выключение кондиционера",
        "description": "Выключить кондиционер при температуре ниже 20°C",
        "condition_sensor_type": "TEMPERATURE",
        "condition_operator": "LT",
        "condition_value": 20.0,
        "action_equipment_type": "AC",
        "action_command": "TURN_OFF",
    },
    {
        "name": "Ночное освещение",
        "description": "Включить свет в коридорах при освещённости ниже 50 люкс",
        "condition_sensor_type": "LIGHT",
        "condition_operator": "LT",
        "condition_value": 50.0,
        "action_equipment_type": "LIGHT",
        "action_command": "TURN_ON",
        "schedule_cron": "0 22 * * *",
        "schedule_description": "После 22:00",
    },
    {
        "name": "Вентиляция при CO2",
        "description": "Включить вентиляцию при уровне CO2 выше 1000 ppm",
        "condition_sensor_type": "CO2",
        "condition_operator": "GT",
        "condition_value": 1000.0,
        "action_equipment_type": "VENTILATION",
        "action_command": "TURN_ON",
    },
    {
        "name": "Аварийная протечка",
        "description": "Оповещение при обнаружении протечки воды",
        "condition_sensor_type": "WATER_LEAK",
        "condition_operator": "GT",
        "condition_value": 0.0,
        "action_equipment_type": None,
        "action_command": "TURN_OFF",
    },
    {
        "name": "Контроль влажности серверной",
        "description": "Включить вентиляцию при влажности выше 65%",
        "condition_sensor_type": "HUMIDITY",
        "condition_operator": "GT",
        "condition_value": 65.0,
        "action_equipment_type": "VENTILATION",
        "action_command": "TURN_ON",
    },
    {
        "name": "Защита от перегрева труб",
        "description": "Оповещение при температуре трубы выше 85°C",
        "condition_sensor_type": "PIPE_TEMPERATURE",
        "condition_operator": "GT",
        "condition_value": 85.0,
        "action_equipment_type": None,
        "action_command": "TURN_OFF",
    },
    {
        "name": "Авто-свет при движении",
        "description": "Включить свет при обнаружении движения",
        "condition_sensor_type": "MOTION",
        "condition_operator": "GT",
        "condition_value": 0.0,
        "action_equipment_type": "LIGHT",
        "action_command": "TURN_ON",
    },
    {
        "name": "Экономия электроэнергии",
        "description": "Выключить свет при высокой освещённости (более 700 люкс)",
        "condition_sensor_type": "LIGHT",
        "condition_operator": "GT",
        "condition_value": 700.0,
        "action_equipment_type": "LIGHT",
        "action_command": "TURN_OFF",
    },
    {
        "name": "Мониторинг энергопотребления",
        "description": "Оповещение при энергопотреблении выше 80 кВт*ч",
        "condition_sensor_type": "POWER_METER",
        "condition_operator": "GT",
        "condition_value": 80.0,
        "action_equipment_type": None,
        "action_command": "TURN_OFF",
    },
]


# ── Alert definitions for seeding ────────────────────────────────────────────

ALERT_TEMPLATES = [
    (BmsAlertType.HIGH_TEMPERATURE, BmsAlertSeverity.WARNING, "Повышенная температура", "Зафиксирована температура выше нормы"),
    (BmsAlertType.HIGH_TEMPERATURE, BmsAlertSeverity.CRITICAL, "Критическая температура", "Температура превысила критический порог"),
    (BmsAlertType.LOW_TEMPERATURE, BmsAlertSeverity.WARNING, "Пониженная температура", "Зафиксирована температура ниже нормы"),
    (BmsAlertType.HIGH_HUMIDITY, BmsAlertSeverity.WARNING, "Высокая влажность", "Влажность выше допустимой нормы"),
    (BmsAlertType.LOW_HUMIDITY, BmsAlertSeverity.WARNING, "Низкая влажность", "Влажность ниже допустимой нормы"),
    (BmsAlertType.HIGH_CO2, BmsAlertSeverity.WARNING, "Высокий CO2", "Уровень CO2 превышает норму"),
    (BmsAlertType.HIGH_CO2, BmsAlertSeverity.CRITICAL, "Критический CO2", "Уровень CO2 критически высок"),
    (BmsAlertType.SMOKE_DETECTED, BmsAlertSeverity.EMERGENCY, "Обнаружен дым", "Сработал датчик дыма"),
    (BmsAlertType.WATER_LEAK, BmsAlertSeverity.EMERGENCY, "Протечка воды", "Обнаружена протечка воды"),
    (BmsAlertType.EQUIPMENT_ERROR, BmsAlertSeverity.WARNING, "Ошибка оборудования", "Оборудование сообщило об ошибке"),
    (BmsAlertType.SENSOR_OFFLINE, BmsAlertSeverity.WARNING, "Датчик офлайн", "Датчик перестал отправлять данные"),
    (BmsAlertType.PIPE_FREEZE_RISK, BmsAlertSeverity.CRITICAL, "Риск замерзания", "Температура трубы опасно низкая"),
    (BmsAlertType.MOTION_AFTER_HOURS, BmsAlertSeverity.INFO, "Движение в нерабочее время", "Обнаружено движение после рабочих часов"),
]


async def seed() -> None:
    async with async_session_factory() as session:
        # Get first clinic
        result = await session.execute(select(Clinic).where(Clinic.is_deleted == False).limit(1))
        clinic = result.scalar_one_or_none()
        if not clinic:
            print("No clinic found. Run main seed first.")
            return

        clinic_id = clinic.id
        print(f"Using clinic: {clinic.name} ({clinic_id})")

        # Get a user for equipment commands
        result = await session.execute(select(User).where(User.clinic_id == clinic_id, User.is_deleted == False).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No user found. Run main seed first.")
            return
        user_id = user.id

        # ── Building ──
        building_id = uuid.uuid4()
        building = Building(
            id=building_id,
            clinic_id=clinic_id,
            name="MedCore Clinic",
            address="ул. Медицинская, 42",
            total_floors=4,
            description="Основное здание клиники MedCore — 4 этажа включая подвальное помещение",
        )
        session.add(building)
        print(f"Building: {building.name}")

        all_sensors: list[tuple[uuid.UUID, str, str]] = []  # (sensor_id, sensor_type, unit)
        all_floors: list[uuid.UUID] = []
        all_rooms: list[uuid.UUID] = []
        all_equipment: list[uuid.UUID] = []
        floor_sensor_map: dict[uuid.UUID, list[uuid.UUID]] = {}  # floor_id -> [sensor_ids]
        room_sensor_map: dict[uuid.UUID, list[uuid.UUID]] = {}

        for floor_def in FLOORS:
            floor_id = uuid.uuid4()
            all_floors.append(floor_id)
            floor_sensor_map[floor_id] = []
            floor = Floor(
                id=floor_id,
                clinic_id=clinic_id,
                building_id=building_id,
                floor_number=floor_def["number"],
                name=floor_def["name"],
                grid_cols=floor_def["grid_cols"],
                grid_rows=floor_def["grid_rows"],
                sort_order=floor_def["sort_order"],
            )
            session.add(floor)

            # Zones
            zone_ids: list[uuid.UUID] = []
            for zone_def in floor_def["zones"]:
                zone_id = uuid.uuid4()
                zone_ids.append(zone_id)
                zone = Zone(
                    id=zone_id,
                    clinic_id=clinic_id,
                    floor_id=floor_id,
                    name=zone_def["name"],
                    color=zone_def["color"],
                )
                session.add(zone)

            # Rooms
            for room_def in floor_def["rooms"]:
                room_id = uuid.uuid4()
                all_rooms.append(room_id)
                room_sensor_map[room_id] = []
                zone_idx = room_def.get("zone_idx", 0)
                zone_id = zone_ids[zone_idx] if zone_idx < len(zone_ids) else None

                room = BmsRoom(
                    id=room_id,
                    clinic_id=clinic_id,
                    floor_id=floor_id,
                    zone_id=zone_id,
                    name=room_def["name"],
                    room_type=BmsRoomType(room_def["type"]),
                    grid_x=room_def["x"],
                    grid_y=room_def["y"],
                    grid_w=room_def["w"],
                    grid_h=room_def["h"],
                )
                session.add(room)

                # Sensors
                for i, st in enumerate(room_def["sensors"]):
                    sensor_id = uuid.uuid4()
                    sensor_name = f"{SENSOR_NAMES.get(st, st)} — {room_def['name']}"
                    serial = f"BMS-{floor_def['number']:+d}-{room_def['name'][:3].upper()}-{st[:4]}-{i:02d}"
                    # Distribute sensor positions within room
                    x_off = round(0.2 + (i % 3) * 0.3, 2)
                    y_off = round(0.2 + (i // 3) * 0.3, 2)
                    sensor = BmsSensor(
                        id=sensor_id,
                        clinic_id=clinic_id,
                        bms_room_id=room_id,
                        floor_id=floor_id,
                        sensor_type=BmsSensorType(st),
                        name=sensor_name,
                        serial_number=serial,
                        is_active=True,
                        grid_x_offset=x_off,
                        grid_y_offset=y_off,
                    )
                    session.add(sensor)
                    all_sensors.append((sensor_id, st, _gen_bms_reading(st)[2]))
                    floor_sensor_map[floor_id].append(sensor_id)
                    room_sensor_map[room_id].append(sensor_id)

                # Equipment
                for eq_type_str, eq_name in room_def.get("equipment", []):
                    eq_id = uuid.uuid4()
                    all_equipment.append(eq_id)
                    eq = Equipment(
                        id=eq_id,
                        clinic_id=clinic_id,
                        bms_room_id=room_id,
                        equipment_type=EquipmentType(eq_type_str),
                        name=eq_name,
                        model=f"Model-{random.randint(100, 999)}",
                        status=random.choice([EquipmentStatus.ON, EquipmentStatus.OFF, EquipmentStatus.STANDBY]),
                        is_controllable=True,
                        last_status_change=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48)),
                    )
                    session.add(eq)

            print(f"  Floor {floor_def['number']}: {floor_def['name']} — {len(floor_def['rooms'])} rooms")

        await session.flush()

        # ── Historical readings (7 days, every 5 min) ──
        print(f"Generating readings for {len(all_sensors)} sensors (7 days)...")
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=7)

        batch_count = 0
        for sensor_id, sensor_type, unit in all_sensors:
            current = start
            readings = []
            last_val = None
            last_val_text = None
            while current <= now:
                val, val_text, u = _gen_bms_reading(sensor_type)
                readings.append(BmsSensorReading(
                    id=uuid.uuid4(),
                    sensor_id=sensor_id,
                    value=val,
                    value_text=val_text,
                    unit=u,
                    recorded_at=current,
                ))
                last_val = val
                last_val_text = val_text
                current += timedelta(minutes=5)

            session.add_all(readings)
            batch_count += len(readings)

            # Update sensor last values
            sensor_q = select(BmsSensor).where(BmsSensor.id == sensor_id)
            sensor_res = await session.execute(sensor_q)
            sensor_obj = sensor_res.scalar_one()
            sensor_obj.last_value = last_val
            sensor_obj.last_value_text = last_val_text
            sensor_obj.last_reading_at = now

            # Flush every 10 sensors to avoid memory buildup
            if batch_count > 20000:
                await session.flush()
                batch_count = 0

        await session.flush()
        print(f"  Total readings created: {sum(1 for _ in all_sensors) * 2016} (approx)")

        # ── Alerts (30-50) ──
        num_alerts = random.randint(30, 50)
        print(f"Generating {num_alerts} alerts...")
        for _ in range(num_alerts):
            alert_template = random.choice(ALERT_TEMPLATES)
            alert_type, severity, title, message = alert_template
            alert_at = start + timedelta(hours=random.randint(1, 168))
            status = random.choice([
                BmsAlertStatus.ACTIVE, BmsAlertStatus.ACTIVE,
                BmsAlertStatus.ACKNOWLEDGED,
                BmsAlertStatus.RESOLVED, BmsAlertStatus.RESOLVED,
                BmsAlertStatus.AUTO_RESOLVED,
            ])
            floor_id = random.choice(all_floors)
            room_id = random.choice(all_rooms)

            alert = BmsAlert(
                id=uuid.uuid4(),
                clinic_id=clinic_id,
                floor_id=floor_id,
                bms_room_id=room_id,
                alert_type=alert_type,
                severity=severity,
                title=title,
                message=message,
                status=status,
                created_at=alert_at,
            )
            if status in (BmsAlertStatus.ACKNOWLEDGED, BmsAlertStatus.RESOLVED, BmsAlertStatus.AUTO_RESOLVED):
                alert.acknowledged_by_id = user_id
                alert.acknowledged_at = alert_at + timedelta(minutes=random.randint(1, 10))
            if status in (BmsAlertStatus.RESOLVED, BmsAlertStatus.AUTO_RESOLVED):
                alert.resolved_by_id = user_id
                alert.resolved_at = alert_at + timedelta(minutes=random.randint(10, 60))
            session.add(alert)

        await session.flush()

        # ── Automation Rules (10) ──
        print(f"Generating {len(RULES_DEFS)} automation rules...")
        rule_ids: list[uuid.UUID] = []
        for rule_def in RULES_DEFS:
            rule_id = uuid.uuid4()
            rule_ids.append(rule_id)
            rule = AutomationRule(
                id=rule_id,
                clinic_id=clinic_id,
                name=rule_def["name"],
                description=rule_def.get("description"),
                is_active=True,
                condition_sensor_type=rule_def["condition_sensor_type"],
                condition_operator=ConditionOperator(rule_def["condition_operator"]),
                condition_value=rule_def["condition_value"],
                action_equipment_type=rule_def.get("action_equipment_type"),
                action_command=rule_def["action_command"],
                action_parameters=rule_def.get("action_parameters"),
                schedule_cron=rule_def.get("schedule_cron"),
                schedule_description=rule_def.get("schedule_description"),
                trigger_count=random.randint(5, 100),
                last_triggered_at=now - timedelta(hours=random.randint(1, 48)),
            )
            session.add(rule)

        await session.flush()

        # ── Automation Logs (20-30) ──
        num_logs = random.randint(20, 30)
        print(f"Generating {num_logs} automation logs...")
        for _ in range(num_logs):
            rule_id = random.choice(rule_ids)
            log_at = start + timedelta(hours=random.randint(1, 168))
            success = random.random() < 0.9  # 90% success rate
            log = AutomationLog(
                id=uuid.uuid4(),
                rule_id=rule_id,
                triggered_at=log_at,
                sensor_value=round(random.uniform(10, 100), 1),
                action_taken=random.choice(["TURN_ON AC", "TURN_OFF LIGHT", "TURN_ON VENTILATION", "TURN_ON LIGHT", "TURN_OFF AC"]),
                success=success,
                error_message="Оборудование не отвечает" if not success else None,
            )
            session.add(log)

        await session.flush()

        # ── Equipment Commands (20-30) ──
        num_cmds = random.randint(20, 30)
        print(f"Generating {num_cmds} equipment commands...")
        for _ in range(num_cmds):
            eq_id = random.choice(all_equipment)
            cmd_at = start + timedelta(hours=random.randint(1, 168))
            cmd_type = random.choice([EquipmentCommandType.TURN_ON, EquipmentCommandType.TURN_OFF, EquipmentCommandType.SET_PARAMETER, EquipmentCommandType.RESTART])
            cmd_status = random.choice([CommandStatus.EXECUTED, CommandStatus.EXECUTED, CommandStatus.EXECUTED, CommandStatus.FAILED])
            params = None
            if cmd_type == EquipmentCommandType.SET_PARAMETER:
                params = {"temperature": random.randint(18, 26)}

            cmd = EquipmentCommand(
                id=uuid.uuid4(),
                clinic_id=clinic_id,
                equipment_id=eq_id,
                command=cmd_type,
                parameters=params,
                issued_by_id=user_id,
                issued_at=cmd_at,
                status=cmd_status,
                executed_at=cmd_at + timedelta(seconds=random.randint(1, 5)) if cmd_status == CommandStatus.EXECUTED else None,
                error_message="Timeout: оборудование не отвечает" if cmd_status == CommandStatus.FAILED else None,
            )
            session.add(cmd)

        await session.commit()
        print("BMS seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
