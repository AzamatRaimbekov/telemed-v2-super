"""Background task that generates realistic BMS sensor data every 10 seconds.

Usage: call `start_bms_simulator()` once at application startup (e.g. in lifespan).
The simulator writes BmsSensorReading rows, creates alerts, evaluates automation rules,
and broadcasts updates via the BMS WebSocket manager.
"""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.bms import (
    BmsSensor, BmsSensorReading, BmsAlert,
    BmsSensorType, BmsAlertType, BmsAlertSeverity, BmsAlertStatus,
)
from app.services.bms import evaluate_bms_severity, BmsService


_task: asyncio.Task | None = None


def start_bms_simulator() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_run_bms_loop())


def stop_bms_simulator() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()


# ── State per sensor (in-memory) ─────────────────────────────────────────────

_bms_state: dict[str, float] = {}

DEFAULTS = {
    "TEMPERATURE":      {"base": 22,  "drift": 0.3, "unit": "°C"},
    "HUMIDITY":          {"base": 50,  "drift": 1,   "unit": "%"},
    "CO2":              {"base": 600, "drift": 20,  "unit": "ppm"},
    "LIGHT":            {"base": 400, "drift": 10,  "unit": "lux"},
    "SMOKE":            {"unit": "bool"},
    "WATER_LEAK":       {"unit": "bool"},
    "MOTION":           {"unit": "bool"},
    "DOOR_SENSOR":      {"unit": "bool"},
    "POWER_METER":      {"base": 50,  "drift": 2,   "unit": "kWh"},
    "PIPE_TEMPERATURE": {"base": 60,  "drift": 1,   "unit": "°C"},
}

# Alert type mapping for sensor events
_ALERT_MAP: dict[str, tuple[BmsAlertType, str, str]] = {
    "TEMPERATURE_HIGH":      (BmsAlertType.HIGH_TEMPERATURE, "Высокая температура", "Температура {value}°C превышает норму"),
    "TEMPERATURE_LOW":       (BmsAlertType.LOW_TEMPERATURE, "Низкая температура", "Температура {value}°C ниже нормы"),
    "HUMIDITY_HIGH":         (BmsAlertType.HIGH_HUMIDITY, "Высокая влажность", "Влажность {value}% превышает норму"),
    "HUMIDITY_LOW":          (BmsAlertType.LOW_HUMIDITY, "Низкая влажность", "Влажность {value}% ниже нормы"),
    "CO2_HIGH":              (BmsAlertType.HIGH_CO2, "Высокий CO2", "Уровень CO2 {value} ppm превышает норму"),
    "SMOKE_DETECTED":        (BmsAlertType.SMOKE_DETECTED, "Обнаружен дым", "Датчик дыма сработал"),
    "WATER_LEAK_DETECTED":   (BmsAlertType.WATER_LEAK, "Протечка воды", "Датчик протечки сработал"),
    "PIPE_TEMPERATURE_HIGH": (BmsAlertType.HIGH_TEMPERATURE, "Высокая температура трубы", "Температура трубы {value}°C"),
    "PIPE_TEMPERATURE_LOW":  (BmsAlertType.PIPE_FREEZE_RISK, "Риск замерзания трубы", "Температура трубы {value}°C"),
}


def _next_bms_value(sensor_id: str, sensor_type: str) -> tuple[float | None, str | None, str]:
    """Generate realistic value for a BMS sensor. Returns (value, value_text, unit)."""
    cfg = DEFAULTS.get(sensor_type, {})
    unit = cfg.get("unit", "")

    # Binary sensors
    if sensor_type == "SMOKE":
        detected = random.random() < 0.0001  # 0.01% chance
        return (1.0 if detected else 0.0, "DETECTED" if detected else "NORMAL", unit)

    if sensor_type == "WATER_LEAK":
        detected = random.random() < 0.0001  # 0.01% chance
        return (1.0 if detected else 0.0, "DETECTED" if detected else "NORMAL", unit)

    if sensor_type == "MOTION":
        active = random.random() < 0.5  # 50% active
        return (1.0 if active else 0.0, "MOTION" if active else "NO_MOTION", unit)

    if sensor_type == "DOOR_SENSOR":
        is_open = random.random() < 0.05  # 5% open
        return (1.0 if is_open else 0.0, "OPEN" if is_open else "CLOSED", unit)

    # Analog sensors — random walk with mean reversion
    base = cfg.get("base", 0)
    drift = cfg.get("drift", 1)
    key = f"{sensor_id}_{sensor_type}"
    prev = _bms_state.get(key, base)

    change = random.gauss(0, drift) + (base - prev) * 0.1
    value = round(prev + change, 1)
    _bms_state[key] = value

    # Occasional spike for demo (0.5% chance)
    if random.random() < 0.005:
        if sensor_type == "TEMPERATURE":
            value = round(random.uniform(30, 35), 1)
        elif sensor_type == "HUMIDITY":
            value = round(random.uniform(75, 90), 0)
        elif sensor_type == "CO2":
            value = round(random.uniform(1200, 1800), 0)
        elif sensor_type == "PIPE_TEMPERATURE":
            value = round(random.uniform(85, 100), 1)

    return (value, None, unit)


def _get_alert_key(sensor_type: str, value: float) -> str | None:
    """Determine the alert map key based on sensor type and value."""
    cfg = DEFAULTS.get(sensor_type, {})
    base = cfg.get("base")
    if base is None:
        return None
    if value > base:
        return f"{sensor_type}_HIGH"
    return f"{sensor_type}_LOW"


async def _run_bms_loop() -> None:
    while True:
        try:
            async with async_session_factory() as session:
                query = select(BmsSensor).where(
                    BmsSensor.is_active == True,
                    BmsSensor.is_deleted == False,
                )
                result = await session.execute(query)
                sensors = result.scalars().all()

                for sensor in sensors:
                    st = sensor.sensor_type.value
                    val, val_text, unit = _next_bms_value(str(sensor.id), st)

                    now = datetime.now(timezone.utc)
                    reading = BmsSensorReading(
                        id=uuid.uuid4(),
                        sensor_id=sensor.id,
                        value=val,
                        value_text=val_text,
                        unit=unit,
                        recorded_at=now,
                    )
                    session.add(reading)
                    sensor.last_value = val
                    sensor.last_value_text = val_text
                    sensor.last_reading_at = now

                    # Evaluate severity
                    severity = evaluate_bms_severity(st, val, val_text)

                    # Create alerts for WARNING / CRITICAL / EMERGENCY
                    if severity in ("WARNING", "CRITICAL", "EMERGENCY"):
                        # Special binary sensors
                        if st == "SMOKE" and val_text == "DETECTED":
                            mapping = _ALERT_MAP.get("SMOKE_DETECTED")
                        elif st == "WATER_LEAK" and val_text == "DETECTED":
                            mapping = _ALERT_MAP.get("WATER_LEAK_DETECTED")
                        else:
                            alert_key = _get_alert_key(st, val) if val is not None else None
                            mapping = _ALERT_MAP.get(alert_key) if alert_key else None

                        if mapping:
                            alert_type, title, msg_tpl = mapping
                            alert = BmsAlert(
                                id=uuid.uuid4(),
                                clinic_id=sensor.clinic_id,
                                floor_id=sensor.floor_id,
                                bms_room_id=sensor.bms_room_id,
                                sensor_id=sensor.id,
                                alert_type=alert_type,
                                severity=BmsAlertSeverity(severity),
                                title=title,
                                message=msg_tpl.format(value=val),
                                status=BmsAlertStatus.ACTIVE,
                            )
                            session.add(alert)

                    # Evaluate automation rules
                    if val is not None and st not in ("MOTION", "DOOR_SENSOR"):
                        svc = BmsService(session)
                        await svc.evaluate_rules(
                            clinic_id=sensor.clinic_id,
                            sensor_type=st,
                            value=val,
                            floor_id=sensor.floor_id,
                            room_id=sensor.bms_room_id,
                        )

                    # Broadcast to WebSocket
                    try:
                        from app.api.v1.routes.infrastructure import bms_manager
                        await bms_manager.broadcast(str(sensor.clinic_id), {
                            "type": "sensor_update",
                            "sensor_id": str(sensor.id),
                            "sensor_type": st,
                            "value": val,
                            "value_text": val_text,
                            "unit": unit,
                            "severity": severity,
                            "timestamp": now.isoformat(),
                        })
                    except Exception:
                        pass  # No WS clients connected — ignore

                await session.commit()

        except asyncio.CancelledError:
            return
        except Exception:
            import traceback
            traceback.print_exc()

        await asyncio.sleep(10)
