"""Background task that generates realistic mock sensor data every 5 seconds.

Usage: call `start_simulator()` once at application startup (e.g. in lifespan).
The simulator writes SensorReading rows and broadcasts updates via the WS manager.
"""
from __future__ import annotations

import asyncio
import math
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.monitoring import (
    SensorDevice, SensorReading, MonitoringAlert, DeviceType,
    AlertType, AlertSeverity, AlertStatus,
)
from app.services.monitoring import evaluate_severity, ALERT_MAP


_task: asyncio.Task | None = None


def start_simulator() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_run_loop())


def stop_simulator() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()


# ── State per sensor (in-memory) ─────────────────────────────────────────────

_state: dict[str, float] = {}

DEFAULTS = {
    "HEART_RATE":        {"base": 75, "drift": 3, "unit": "bpm"},
    "SPO2":              {"base": 97, "drift": 0.5, "unit": "%"},
    "BODY_TEMPERATURE":  {"base": 36.6, "drift": 0.1, "unit": "°C"},
    "BLOOD_PRESSURE":    {"base": 120, "drift": 3, "base2": 78, "drift2": 2, "unit": "mmHg"},
    "FALL_DETECTOR":     {"unit": "bool"},
    "ROOM_TEMPERATURE":  {"base": 22.0, "drift": 0.2, "unit": "°C"},
    "HUMIDITY":          {"base": 50, "drift": 1, "unit": "%"},
    "MOTION":            {"unit": "bool"},
    "DOOR":              {"unit": "bool"},
}


def _next_value(sensor_id: str, device_type: str) -> tuple[float | None, float | None, str | None, str]:
    cfg = DEFAULTS.get(device_type, {})
    unit = cfg.get("unit", "")

    if device_type == "FALL_DETECTOR":
        fell = random.random() < 0.001  # ~0.1% chance per tick
        return (1.0 if fell else 0.0, None, "FALL_DETECTED" if fell else "NORMAL", unit)

    if device_type == "MOTION":
        has_motion = random.random() < 0.7
        return (1.0 if has_motion else 0.0, None, "MOTION" if has_motion else "NO_MOTION", unit)

    if device_type == "DOOR":
        is_open = random.random() < 0.05
        return (1.0 if is_open else 0.0, None, "OPEN" if is_open else "CLOSED", unit)

    base = cfg.get("base", 0)
    drift = cfg.get("drift", 1)
    key = f"{sensor_id}_{device_type}"
    prev = _state.get(key, base)

    # Random walk with mean reversion
    change = random.gauss(0, drift) + (base - prev) * 0.1
    value = round(prev + change, 1)
    _state[key] = value

    # Occasional spike for demo
    if random.random() < 0.005:
        if device_type == "HEART_RATE":
            value = round(random.uniform(135, 150), 0)
        elif device_type == "SPO2":
            value = round(random.uniform(85, 90), 0)
        elif device_type == "BODY_TEMPERATURE":
            value = round(random.uniform(38.5, 39.5), 1)

    value2 = None
    if device_type == "BLOOD_PRESSURE":
        base2 = cfg.get("base2", 78)
        drift2 = cfg.get("drift2", 2)
        key2 = f"{sensor_id}_{device_type}_2"
        prev2 = _state.get(key2, base2)
        change2 = random.gauss(0, drift2) + (base2 - prev2) * 0.1
        value2 = round(prev2 + change2, 0)
        _state[key2] = value2

    return (value, value2, None, unit)


async def _run_loop() -> None:
    while True:
        try:
            async with async_session_factory() as session:
                query = select(SensorDevice).where(
                    SensorDevice.is_active == True,
                    SensorDevice.is_deleted == False,
                )
                result = await session.execute(query)
                sensors = result.scalars().all()

                for sensor in sensors:
                    dt = sensor.device_type.value
                    val, val2, val_text, unit = _next_value(str(sensor.id), dt)

                    now = datetime.now(timezone.utc)
                    reading = SensorReading(
                        id=uuid.uuid4(),
                        sensor_id=sensor.id,
                        value=val,
                        value_secondary=val2,
                        value_text=val_text,
                        unit=unit,
                        recorded_at=now,
                    )
                    session.add(reading)
                    sensor.last_reading_at = now

                    # Evaluate severity & maybe create alert
                    severity = evaluate_severity(dt, val, val2) if val is not None else "NORMAL"

                    # Special: fall detected
                    if dt == "FALL_DETECTOR" and val_text == "FALL_DETECTED":
                        severity = "CRITICAL"
                        alert = MonitoringAlert(
                            id=uuid.uuid4(),
                            clinic_id=sensor.clinic_id,
                            patient_id=sensor.patient_id,
                            room_id=sensor.room_id,
                            sensor_id=sensor.id,
                            alert_type=AlertType.FALL_DETECTED,
                            severity=AlertSeverity.CRITICAL,
                            title="Падение пациента",
                            message="Датчик зафиксировал падение",
                            status=AlertStatus.ACTIVE,
                        )
                        session.add(alert)

                    elif severity in ("WARNING", "CRITICAL") and dt not in ("MOTION", "DOOR"):
                        # Create alert for threshold breaches
                        alert_key = f"{dt}_HIGH" if val and val > DEFAULTS.get(dt, {}).get("base", 0) else f"{dt}_LOW"
                        mapping = ALERT_MAP.get(alert_key)
                        if mapping:
                            alert_type, title, msg_tpl = mapping
                            alert = MonitoringAlert(
                                id=uuid.uuid4(),
                                clinic_id=sensor.clinic_id,
                                patient_id=sensor.patient_id,
                                room_id=sensor.room_id,
                                sensor_id=sensor.id,
                                alert_type=alert_type,
                                severity=AlertSeverity(severity),
                                title=title,
                                message=msg_tpl.format(value=val, secondary=val2 or ""),
                                status=AlertStatus.ACTIVE,
                            )
                            session.add(alert)

                    # Broadcast to WS
                    if sensor.patient_id:
                        from app.api.v1.routes.monitoring import manager
                        await manager.broadcast(str(sensor.patient_id), {
                            "type": "sensor_update",
                            "sensor_id": str(sensor.id),
                            "device_type": dt,
                            "value": val,
                            "value_secondary": val2,
                            "value_text": val_text,
                            "unit": unit,
                            "severity": severity,
                            "timestamp": now.isoformat(),
                        })

                await session.commit()

        except asyncio.CancelledError:
            return
        except Exception as exc:
            import traceback
            traceback.print_exc()

        await asyncio.sleep(5)
