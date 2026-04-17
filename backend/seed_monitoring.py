"""Seed monitoring data: cameras, sensors, 7 days of historical readings, alerts, nurse calls."""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.facility import Room, RoomType
from app.models.room_assignment import RoomAssignment
from app.models.monitoring import (
    RoomCamera, SensorDevice, SensorReading, MonitoringAlert, NurseCall,
    CameraType, DeviceType, DeviceCategory,
    AlertType, AlertSeverity, AlertStatus, NurseCallStatus,
)


WEARABLE_SENSORS = [
    (DeviceType.HEART_RATE, "Пульсоксиметр (пульс)", "bpm"),
    (DeviceType.SPO2, "Пульсоксиметр (SpO2)", "%"),
    (DeviceType.BODY_TEMPERATURE, "Термометр (тело)", "°C"),
    (DeviceType.BLOOD_PRESSURE, "Тонометр", "mmHg"),
    (DeviceType.FALL_DETECTOR, "Датчик падения", "bool"),
]

ROOM_SENSORS = [
    (DeviceType.ROOM_TEMPERATURE, "Термометр (палата)", "°C"),
    (DeviceType.HUMIDITY, "Гигрометр", "%"),
    (DeviceType.MOTION, "Датчик движения", "bool"),
    (DeviceType.DOOR, "Датчик двери", "bool"),
]

CAMERA_NAMES = [
    (CameraType.OVERVIEW, "Общий вид"),
    (CameraType.BEDSIDE, "У кровати"),
    (CameraType.ENTRANCE, "Вход"),
]


async def seed() -> None:
    async with async_session_factory() as session:
        # Check if already seeded
        existing_sensors = await session.execute(select(SensorDevice).limit(1))
        if existing_sensors.scalar_one_or_none():
            print("Monitoring already seeded. Skipping.")
            return

        # Find active room assignments (patients currently in rooms)
        query = (
            select(RoomAssignment)
            .where(RoomAssignment.released_at.is_(None), RoomAssignment.is_deleted == False)
        )
        result = await session.execute(query)
        assignments = result.scalars().all()

        if not assignments:
            print("No active room assignments found. Skipping monitoring seed.")
            return

        print(f"Found {len(assignments)} active room assignments")

        seen_rooms: set[str] = set()

        for assignment in assignments:
            clinic_id = assignment.clinic_id
            patient_id = assignment.patient_id
            room_id = assignment.room_id
            room_key = str(room_id)

            # ── Cameras (per room, not per patient) ──
            if room_key not in seen_rooms:
                seen_rooms.add(room_key)
                for i, (cam_type, cam_name) in enumerate(CAMERA_NAMES):
                    camera = RoomCamera(
                        id=uuid.uuid4(), clinic_id=clinic_id, room_id=room_id,
                        name=cam_name, camera_type=cam_type,
                        is_active=True, position_order=i,
                    )
                    session.add(camera)

                # ── Room sensors (per room) ──
                for dev_type, dev_name, unit in ROOM_SENSORS:
                    sensor = SensorDevice(
                        id=uuid.uuid4(), clinic_id=clinic_id, room_id=room_id,
                        patient_id=patient_id,
                        device_type=dev_type, device_category=DeviceCategory.STATIONARY,
                        name=dev_name, is_active=True,
                    )
                    session.add(sensor)

            # ── Wearable sensors (per patient) ──
            sensor_ids: list[tuple[uuid.UUID, str, str]] = []
            for dev_type, dev_name, unit in WEARABLE_SENSORS:
                sid = uuid.uuid4()
                sensor = SensorDevice(
                    id=sid, clinic_id=clinic_id, room_id=room_id,
                    patient_id=patient_id,
                    device_type=dev_type, device_category=DeviceCategory.WEARABLE,
                    name=dev_name, is_active=True,
                )
                session.add(sensor)
                sensor_ids.append((sid, dev_type.value, unit))

            await session.flush()

            # ── Historical readings (7 days, every 5 min = ~2016 readings per sensor) ──
            now = datetime.now(timezone.utc)
            start = now - timedelta(days=7)
            current = start
            readings = []

            while current <= now:
                for sid, dt, unit in sensor_ids:
                    val, val2, val_text = _gen_reading(dt)
                    readings.append(SensorReading(
                        id=uuid.uuid4(), sensor_id=sid,
                        value=val, value_secondary=val2, value_text=val_text,
                        unit=unit, recorded_at=current,
                    ))
                current += timedelta(minutes=5)

            session.add_all(readings)
            print(f"  Patient {str(patient_id)[:8]}... → {len(readings)} readings")

            # ── Sample alerts ──
            for _ in range(random.randint(5, 15)):
                alert_at = start + timedelta(hours=random.randint(1, 168))
                sev = random.choice([AlertSeverity.WARNING, AlertSeverity.WARNING, AlertSeverity.CRITICAL])
                atype = random.choice(list(AlertType))
                status = random.choice([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED, AlertStatus.RESOLVED])
                alert = MonitoringAlert(
                    id=uuid.uuid4(), clinic_id=clinic_id,
                    patient_id=patient_id, room_id=room_id,
                    alert_type=atype, severity=sev,
                    title=atype.value.replace("_", " ").title(),
                    message=f"Автоматический алерт: {atype.value}",
                    status=status,
                )
                if status in (AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED):
                    alert.acknowledged_at = alert_at + timedelta(minutes=random.randint(1, 5))
                if status == AlertStatus.RESOLVED:
                    alert.resolved_at = alert_at + timedelta(minutes=random.randint(5, 30))
                session.add(alert)

            # ── Sample nurse calls ──
            for _ in range(random.randint(3, 8)):
                call_at = start + timedelta(hours=random.randint(1, 168))
                nc = NurseCall(
                    id=uuid.uuid4(), clinic_id=clinic_id,
                    patient_id=patient_id, room_id=room_id,
                    status=NurseCallStatus.RESOLVED,
                    called_at=call_at,
                    accepted_at=call_at + timedelta(seconds=random.randint(30, 180)),
                    en_route_at=call_at + timedelta(seconds=random.randint(60, 240)),
                    on_site_at=call_at + timedelta(seconds=random.randint(120, 360)),
                    resolved_at=call_at + timedelta(minutes=random.randint(5, 30)),
                    response_time_seconds=random.randint(120, 360),
                )
                session.add(nc)

        await session.commit()
        print("Monitoring seed complete!")


def _gen_reading(device_type: str) -> tuple[float | None, float | None, str | None]:
    if device_type == "HEART_RATE":
        return (round(random.gauss(75, 8), 0), None, None)
    if device_type == "SPO2":
        return (round(min(100, max(88, random.gauss(97, 1.5))), 0), None, None)
    if device_type == "BODY_TEMPERATURE":
        return (round(random.gauss(36.6, 0.3), 1), None, None)
    if device_type == "BLOOD_PRESSURE":
        return (round(random.gauss(120, 10), 0), round(random.gauss(78, 6), 0), None)
    if device_type == "FALL_DETECTOR":
        return (0.0, None, "NORMAL")
    if device_type == "ROOM_TEMPERATURE":
        return (round(random.gauss(22, 0.5), 1), None, None)
    if device_type == "HUMIDITY":
        return (round(random.gauss(50, 5), 0), None, None)
    if device_type == "MOTION":
        return (1.0 if random.random() < 0.6 else 0.0, None, "MOTION" if random.random() < 0.6 else "NO_MOTION")
    if device_type == "DOOR":
        return (0.0, None, "CLOSED")
    return (0.0, None, None)


if __name__ == "__main__":
    asyncio.run(seed())
