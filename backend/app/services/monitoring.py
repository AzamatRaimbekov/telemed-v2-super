from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.monitoring import (
    RoomCamera, SensorDevice, SensorReading, MonitoringAlert, NurseCall,
    AlertType, AlertSeverity, AlertStatus, NurseCallStatus,
    DeviceType, DeviceCategory,
)
from app.models.room_assignment import RoomAssignment


# ── Thresholds ───────────────────────────────────────────────────────────────

THRESHOLDS: dict[str, dict[str, tuple[float | None, float | None]]] = {
    "HEART_RATE":        {"WARNING": (50, 110),  "CRITICAL": (40, 140)},
    "SPO2":              {"WARNING": (93, None),  "CRITICAL": (88, None)},
    "BODY_TEMPERATURE":  {"WARNING": (35.5, 37.5), "CRITICAL": (35.0, 39.0)},
    "BP_SYSTOLIC":       {"WARNING": (90, 150),  "CRITICAL": (80, 180)},
    "BP_DIASTOLIC":      {"WARNING": (55, 95),   "CRITICAL": (50, 110)},
    "ROOM_TEMPERATURE":  {"WARNING": (18, 26),   "CRITICAL": (15, 30)},
    "HUMIDITY":          {"WARNING": (30, 70),    "CRITICAL": (20, 80)},
}


def evaluate_severity(device_type: str, value: float, value_secondary: float | None = None) -> str:
    """Return 'NORMAL', 'WARNING', or 'CRITICAL'."""
    key = device_type
    if device_type == "BLOOD_PRESSURE":
        # Check systolic
        sev_sys = _check_range("BP_SYSTOLIC", value)
        sev_dia = _check_range("BP_DIASTOLIC", value_secondary) if value_secondary else "NORMAL"
        return max([sev_sys, sev_dia], key=lambda s: ["NORMAL", "WARNING", "CRITICAL"].index(s))
    return _check_range(key, value)


def _check_range(key: str, value: float | None) -> str:
    if value is None or key not in THRESHOLDS:
        return "NORMAL"
    crit = THRESHOLDS[key].get("CRITICAL")
    warn = THRESHOLDS[key].get("WARNING")
    if crit:
        lo, hi = crit
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            return "CRITICAL"
    if warn:
        lo, hi = warn
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            return "WARNING"
    return "NORMAL"


# ── Alert Title/Message Mapping ──────────────────────────────────────────────

ALERT_MAP: dict[str, tuple[AlertType, str, str]] = {
    "HEART_RATE_HIGH":       (AlertType.HIGH_HEART_RATE, "Высокий пульс", "Пульс {value} уд/мин превышает порог"),
    "HEART_RATE_LOW":        (AlertType.LOW_HEART_RATE, "Низкий пульс", "Пульс {value} уд/мин ниже порога"),
    "SPO2_LOW":              (AlertType.LOW_SPO2, "Низкий SpO2", "SpO2 {value}% ниже порога"),
    "BODY_TEMPERATURE_HIGH": (AlertType.HIGH_BODY_TEMP, "Высокая температура", "Температура тела {value}°C"),
    "BODY_TEMPERATURE_LOW":  (AlertType.LOW_BODY_TEMP, "Низкая температура", "Температура тела {value}°C"),
    "BLOOD_PRESSURE_HIGH":   (AlertType.HIGH_BP_SYSTOLIC, "Высокое давление", "АД {value}/{secondary} мм рт.ст."),
    "BLOOD_PRESSURE_LOW":    (AlertType.LOW_BP_SYSTOLIC, "Низкое давление", "АД {value}/{secondary} мм рт.ст."),
    "FALL_DETECTED":         (AlertType.FALL_DETECTED, "Падение пациента", "Датчик зафиксировал падение"),
    "ROOM_TEMPERATURE_HIGH": (AlertType.HIGH_ROOM_TEMP, "Жарко в палате", "Температура палаты {value}°C"),
    "ROOM_TEMPERATURE_LOW":  (AlertType.LOW_ROOM_TEMP, "Холодно в палате", "Температура палаты {value}°C"),
    "HUMIDITY_HIGH":         (AlertType.HIGH_HUMIDITY, "Высокая влажность", "Влажность {value}%"),
    "HUMIDITY_LOW":          (AlertType.LOW_HUMIDITY, "Низкая влажность", "Влажность {value}%"),
}


class MonitoringService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Helpers ──────────────────────────────────────────────────────────

    async def _get_patient_room_id(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> uuid.UUID | None:
        query = (
            select(RoomAssignment.room_id)
            .where(
                RoomAssignment.patient_id == patient_id,
                RoomAssignment.clinic_id == clinic_id,
                RoomAssignment.released_at.is_(None),
                RoomAssignment.is_deleted == False,
            )
            .order_by(RoomAssignment.assigned_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    # ── Cameras ──────────────────────────────────────────────────────────

    async def get_cameras(self, room_id: uuid.UUID, clinic_id: uuid.UUID) -> list[RoomCamera]:
        query = (
            select(RoomCamera)
            .where(
                RoomCamera.room_id == room_id,
                RoomCamera.clinic_id == clinic_id,
                RoomCamera.is_deleted == False,
            )
            .order_by(RoomCamera.position_order)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_camera(self, clinic_id: uuid.UUID, data: dict) -> RoomCamera:
        camera = RoomCamera(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(camera)
        await self.session.flush()
        await self.session.refresh(camera)
        return camera

    async def update_camera(self, camera_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> RoomCamera:
        query = select(RoomCamera).where(
            RoomCamera.id == camera_id, RoomCamera.clinic_id == clinic_id, RoomCamera.is_deleted == False
        )
        result = await self.session.execute(query)
        camera = result.scalar_one_or_none()
        if not camera:
            raise NotFoundError("Camera", str(camera_id))
        for k, v in data.items():
            if v is not None:
                setattr(camera, k, v)
        await self.session.flush()
        await self.session.refresh(camera)
        return camera

    async def delete_camera(self, camera_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(RoomCamera).where(
            RoomCamera.id == camera_id, RoomCamera.clinic_id == clinic_id, RoomCamera.is_deleted == False
        )
        result = await self.session.execute(query)
        camera = result.scalar_one_or_none()
        if not camera:
            raise NotFoundError("Camera", str(camera_id))
        camera.is_deleted = True
        await self.session.flush()

    # ── Sensors ──────────────────────────────────────────────────────────

    async def get_sensors(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID, room_id: uuid.UUID | None = None,
    ) -> list[SensorDevice]:
        if room_id is None:
            room_id = await self._get_patient_room_id(patient_id, clinic_id)
        if room_id is None:
            return []
        query = (
            select(SensorDevice)
            .where(
                SensorDevice.clinic_id == clinic_id,
                SensorDevice.is_deleted == False,
                (SensorDevice.patient_id == patient_id) | (SensorDevice.room_id == room_id),
            )
            .order_by(SensorDevice.device_category, SensorDevice.device_type)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_current_readings(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
    ) -> list[dict]:
        sensors = await self.get_sensors(patient_id, clinic_id)
        out = []
        for sensor in sensors:
            # Get latest reading
            reading_q = (
                select(SensorReading)
                .where(SensorReading.sensor_id == sensor.id)
                .order_by(SensorReading.recorded_at.desc())
                .limit(1)
            )
            result = await self.session.execute(reading_q)
            reading = result.scalar_one_or_none()

            severity = "NORMAL"
            if reading and reading.value is not None:
                severity = evaluate_severity(
                    sensor.device_type.value, reading.value, reading.value_secondary
                )

            out.append({
                "sensor_id": sensor.id,
                "device_type": sensor.device_type.value,
                "device_category": sensor.device_category.value,
                "name": sensor.name,
                "value": reading.value if reading else None,
                "value_secondary": reading.value_secondary if reading else None,
                "value_text": reading.value_text if reading else None,
                "unit": reading.unit if reading else "",
                "recorded_at": reading.recorded_at if reading else None,
                "severity": severity,
            })
        return out

    async def get_sensor_readings(
        self, sensor_id: uuid.UUID, from_dt: datetime, to_dt: datetime,
    ) -> list[SensorReading]:
        query = (
            select(SensorReading)
            .where(
                SensorReading.sensor_id == sensor_id,
                SensorReading.recorded_at >= from_dt,
                SensorReading.recorded_at <= to_dt,
            )
            .order_by(SensorReading.recorded_at)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_sensor(self, clinic_id: uuid.UUID, data: dict) -> SensorDevice:
        sensor = SensorDevice(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(sensor)
        await self.session.flush()
        await self.session.refresh(sensor)
        return sensor

    async def delete_sensor(self, sensor_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(SensorDevice).where(
            SensorDevice.id == sensor_id, SensorDevice.clinic_id == clinic_id, SensorDevice.is_deleted == False
        )
        result = await self.session.execute(query)
        sensor = result.scalar_one_or_none()
        if not sensor:
            raise NotFoundError("Sensor", str(sensor_id))
        sensor.is_deleted = True
        await self.session.flush()

    # ── Alerts ───────────────────────────────────────────────────────────

    async def get_alerts(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
        status: str | None = None, severity: str | None = None,
        limit: int = 50,
    ) -> list[MonitoringAlert]:
        clauses = [
            MonitoringAlert.patient_id == patient_id,
            MonitoringAlert.clinic_id == clinic_id,
            MonitoringAlert.is_deleted == False,
        ]
        if status:
            clauses.append(MonitoringAlert.status == AlertStatus(status))
        if severity:
            clauses.append(MonitoringAlert.severity == AlertSeverity(severity))
        query = (
            select(MonitoringAlert)
            .where(*clauses)
            .order_by(MonitoringAlert.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def acknowledge_alert(
        self, alert_id: uuid.UUID, clinic_id: uuid.UUID, user_id: uuid.UUID,
    ) -> MonitoringAlert:
        query = select(MonitoringAlert).where(
            MonitoringAlert.id == alert_id,
            MonitoringAlert.clinic_id == clinic_id,
            MonitoringAlert.is_deleted == False,
        )
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()
        if not alert:
            raise NotFoundError("Alert", str(alert_id))
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_by_id = user_id
        alert.acknowledged_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def resolve_alert(
        self, alert_id: uuid.UUID, clinic_id: uuid.UUID, user_id: uuid.UUID,
    ) -> MonitoringAlert:
        query = select(MonitoringAlert).where(
            MonitoringAlert.id == alert_id,
            MonitoringAlert.clinic_id == clinic_id,
            MonitoringAlert.is_deleted == False,
        )
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()
        if not alert:
            raise NotFoundError("Alert", str(alert_id))
        alert.status = AlertStatus.RESOLVED
        alert.resolved_by_id = user_id
        alert.resolved_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def create_alert(
        self, clinic_id: uuid.UUID, patient_id: uuid.UUID,
        room_id: uuid.UUID | None, sensor_id: uuid.UUID | None,
        alert_type: AlertType, severity: AlertSeverity,
        title: str, message: str,
    ) -> MonitoringAlert:
        alert = MonitoringAlert(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            patient_id=patient_id,
            room_id=room_id,
            sensor_id=sensor_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            status=AlertStatus.ACTIVE,
        )
        self.session.add(alert)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    # ── Nurse Calls ──────────────────────────────────────────────────────

    async def get_nurse_calls(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
        status: str | None = None, limit: int = 20,
    ) -> list[NurseCall]:
        clauses = [
            NurseCall.patient_id == patient_id,
            NurseCall.clinic_id == clinic_id,
            NurseCall.is_deleted == False,
        ]
        if status:
            clauses.append(NurseCall.status == NurseCallStatus(status))
        query = (
            select(NurseCall)
            .where(*clauses)
            .order_by(NurseCall.called_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_nurse_call(
        self, clinic_id: uuid.UUID, patient_id: uuid.UUID, room_id: uuid.UUID,
    ) -> NurseCall:
        call = NurseCall(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            patient_id=patient_id,
            room_id=room_id,
            status=NurseCallStatus.CALLED,
            called_at=datetime.now(timezone.utc),
        )
        self.session.add(call)
        await self.session.flush()
        await self.session.refresh(call)
        return call

    async def update_nurse_call_status(
        self, call_id: uuid.UUID, clinic_id: uuid.UUID,
        new_status: str, user_id: uuid.UUID,
    ) -> NurseCall:
        query = select(NurseCall).where(
            NurseCall.id == call_id, NurseCall.clinic_id == clinic_id, NurseCall.is_deleted == False,
        )
        result = await self.session.execute(query)
        call = result.scalar_one_or_none()
        if not call:
            raise NotFoundError("NurseCall", str(call_id))

        now = datetime.now(timezone.utc)
        status = NurseCallStatus(new_status)
        call.status = status

        if status == NurseCallStatus.ACCEPTED:
            call.accepted_at = now
            call.accepted_by_id = user_id
        elif status == NurseCallStatus.EN_ROUTE:
            call.en_route_at = now
        elif status == NurseCallStatus.ON_SITE:
            call.on_site_at = now
            if call.called_at:
                call.response_time_seconds = int((now - call.called_at).total_seconds())
        elif status == NurseCallStatus.RESOLVED:
            call.resolved_at = now
            call.resolved_by_id = user_id

        await self.session.flush()
        await self.session.refresh(call)
        return call
