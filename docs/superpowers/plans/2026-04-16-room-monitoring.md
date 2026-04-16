# Room Monitoring System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Мониторинг" tab to the patient card with real-time camera feeds (placeholders), IoT sensor readings (wearable + stationary), critical alerts with sound, nurse call workflow, and trend charts — all powered by WebSocket.

**Architecture:** Backend: new SQLAlchemy models (5 tables) + Alembic migration + MonitoringService + WebSocket endpoint + REST CRUD + mock data generator. Frontend: new monitoring tab component with recharts trends, Web Audio alerts, and a custom `useMonitoringWS` hook. Communication: WebSocket for real-time sensor/alert pushes, REST for CRUD and history queries.

**Tech Stack:** FastAPI WebSocket, SQLAlchemy async, Alembic, React 19, TanStack Query, TanStack Router, Recharts, Web Audio API, Zustand (optional for WS state).

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/monitoring.py` | RoomCamera, SensorDevice, SensorReading, MonitoringAlert, NurseCall models + enums |
| `backend/app/schemas/monitoring.py` | Pydantic schemas for all monitoring DTOs |
| `backend/app/services/monitoring.py` | MonitoringService — CRUD, threshold evaluation, alert creation |
| `backend/app/api/v1/routes/monitoring.py` | REST endpoints + WebSocket endpoint |
| `backend/app/services/monitoring_simulator.py` | Mock data generator (background asyncio task) |
| `backend/seed_monitoring.py` | Seed script for initial cameras, sensors, historical data |
| `backend/alembic/versions/xxxx_add_monitoring_tables.py` | Migration for 5 new tables |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Import new models |
| `backend/app/api/v1/router.py` | Include monitoring router |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/routes/_authenticated/patients.$patientId/monitoring.tsx` | Main monitoring tab page |
| `frontend/src/features/monitoring/api.ts` | REST API client for monitoring endpoints |
| `frontend/src/features/monitoring/use-monitoring-ws.ts` | WebSocket hook for real-time data |
| `frontend/src/features/monitoring/alert-sound.ts` | Web Audio API sound generation |
| `frontend/src/features/monitoring/types.ts` | TypeScript types for monitoring domain |
| `frontend/src/features/monitoring/thresholds.ts` | Threshold constants + severity helpers |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/routes/_authenticated/patients.$patientId.tsx` | Add "Мониторинг" tab to TABS array |
| `frontend/src/features/patients/api.ts` | No changes needed (monitoring has its own api.ts) |

---

## Task 1: Backend Models + Migration

**Files:**
- Create: `backend/app/models/monitoring.py`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration via `alembic revision --autogenerate`

- [ ] **Step 1: Create monitoring models file**

Create `backend/app/models/monitoring.py`:

```python
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric,
    String, Text, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


# ── Enums ────────────────────────────────────────────────────────────────────

class CameraType(str, enum.Enum):
    OVERVIEW = "OVERVIEW"
    BEDSIDE = "BEDSIDE"
    ENTRANCE = "ENTRANCE"
    OTHER = "OTHER"


class DeviceType(str, enum.Enum):
    HEART_RATE = "HEART_RATE"
    SPO2 = "SPO2"
    BODY_TEMPERATURE = "BODY_TEMPERATURE"
    BLOOD_PRESSURE = "BLOOD_PRESSURE"
    FALL_DETECTOR = "FALL_DETECTOR"
    ROOM_TEMPERATURE = "ROOM_TEMPERATURE"
    HUMIDITY = "HUMIDITY"
    MOTION = "MOTION"
    DOOR = "DOOR"
    NURSE_CALL = "NURSE_CALL"


class DeviceCategory(str, enum.Enum):
    WEARABLE = "WEARABLE"
    STATIONARY = "STATIONARY"


class AlertType(str, enum.Enum):
    FALL_DETECTED = "FALL_DETECTED"
    HIGH_HEART_RATE = "HIGH_HEART_RATE"
    LOW_HEART_RATE = "LOW_HEART_RATE"
    LOW_SPO2 = "LOW_SPO2"
    HIGH_BODY_TEMP = "HIGH_BODY_TEMP"
    LOW_BODY_TEMP = "LOW_BODY_TEMP"
    HIGH_BP_SYSTOLIC = "HIGH_BP_SYSTOLIC"
    LOW_BP_SYSTOLIC = "LOW_BP_SYSTOLIC"
    HIGH_BP_DIASTOLIC = "HIGH_BP_DIASTOLIC"
    LOW_BP_DIASTOLIC = "LOW_BP_DIASTOLIC"
    HIGH_ROOM_TEMP = "HIGH_ROOM_TEMP"
    LOW_ROOM_TEMP = "LOW_ROOM_TEMP"
    HIGH_HUMIDITY = "HIGH_HUMIDITY"
    LOW_HUMIDITY = "LOW_HUMIDITY"
    NURSE_CALL = "NURSE_CALL"
    DEVICE_OFFLINE = "DEVICE_OFFLINE"


class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class NurseCallStatus(str, enum.Enum):
    CALLED = "CALLED"
    ACCEPTED = "ACCEPTED"
    EN_ROUTE = "EN_ROUTE"
    ON_SITE = "ON_SITE"
    RESOLVED = "RESOLVED"


# ── Models ───────────────────────────────────────────────────────────────────

class RoomCamera(TenantMixin, Base):
    __tablename__ = "room_cameras"

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stream_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    camera_type: Mapped[CameraType] = mapped_column(Enum(CameraType), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    position_order: Mapped[int] = mapped_column(Integer, default=0)

    room = relationship("Room", lazy="selectin")


class SensorDevice(TenantMixin, Base):
    __tablename__ = "sensor_devices"

    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True, index=True,
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True, index=True,
    )
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType), nullable=False)
    device_category: Mapped[DeviceCategory] = mapped_column(Enum(DeviceCategory), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_reading_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room = relationship("Room", lazy="selectin")
    patient = relationship("Patient", lazy="selectin")


class SensorReading(Base):
    """High-volume table — no TenantMixin to save space, tenant derived from sensor."""
    __tablename__ = "sensor_readings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sensor_devices.id"), nullable=False,
    )
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_secondary: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # e.g. diastolic BP
    value_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_sensor_readings_sensor_time", "sensor_id", "recorded_at"),
    )


class MonitoringAlert(TenantMixin, Base):
    __tablename__ = "monitoring_alerts"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True,
    )
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True,
    )
    sensor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sensor_devices.id"), nullable=True,
    )
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), default=AlertStatus.ACTIVE)
    acknowledged_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", lazy="selectin")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")


class NurseCall(TenantMixin, Base):
    __tablename__ = "nurse_calls"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True,
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False,
    )
    status: Mapped[NurseCallStatus] = mapped_column(
        Enum(NurseCallStatus), default=NurseCallStatus.CALLED,
    )
    called_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    en_route_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    on_site_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    response_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient = relationship("Patient", lazy="selectin")
    accepted_by = relationship("User", foreign_keys=[accepted_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")
```

- [ ] **Step 2: Register models in `__init__.py`**

Add to `backend/app/models/__init__.py`:

```python
from app.models.monitoring import (
    RoomCamera, SensorDevice, SensorReading, MonitoringAlert, NurseCall,
)
```

And add to `__all__`:
```python
"RoomCamera", "SensorDevice", "SensorReading", "MonitoringAlert", "NurseCall",
```

- [ ] **Step 3: Generate and run migration**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
python -m alembic revision --autogenerate -m "add monitoring tables"
python -m alembic upgrade head
```

Expected: 5 new tables created (`room_cameras`, `sensor_devices`, `sensor_readings`, `monitoring_alerts`, `nurse_calls`).

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/monitoring.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(monitoring): add models — cameras, sensors, readings, alerts, nurse calls"
```

---

## Task 2: Backend Schemas

**Files:**
- Create: `backend/app/schemas/monitoring.py`

- [ ] **Step 1: Create Pydantic schemas**

Create `backend/app/schemas/monitoring.py`:

```python
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Camera ───────────────────────────────────────────────────────────────────

class CameraCreate(BaseModel):
    room_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    camera_type: str
    stream_url: str | None = None
    position_order: int = 0


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    camera_type: str | None = None
    stream_url: str | None = None
    is_active: bool | None = None
    position_order: int | None = None


class CameraOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    name: str
    camera_type: str
    stream_url: str | None = None
    is_active: bool
    position_order: int
    model_config = {"from_attributes": True}


# ── Sensor ───────────────────────────────────────────────────────────────────

class SensorCreate(BaseModel):
    room_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    device_type: str
    device_category: str
    name: str = Field(..., min_length=1, max_length=255)
    serial_number: str | None = None


class SensorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    serial_number: str | None = None


class SensorOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    device_type: str
    device_category: str
    name: str
    serial_number: str | None = None
    is_active: bool
    last_reading_at: datetime | None = None
    model_config = {"from_attributes": True}


class SensorCurrentReading(BaseModel):
    sensor_id: uuid.UUID
    device_type: str
    device_category: str
    name: str
    value: float | None = None
    value_secondary: float | None = None
    value_text: str | None = None
    unit: str
    recorded_at: datetime | None = None
    severity: str = "NORMAL"  # NORMAL, WARNING, CRITICAL


class ReadingOut(BaseModel):
    id: uuid.UUID
    sensor_id: uuid.UUID
    value: float | None = None
    value_secondary: float | None = None
    value_text: str | None = None
    unit: str
    recorded_at: datetime


# ── Alert ────────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    room_id: uuid.UUID | None = None
    sensor_id: uuid.UUID | None = None
    alert_type: str
    severity: str
    title: str
    message: str
    status: str
    acknowledged_by_name: str | None = None
    acknowledged_at: datetime | None = None
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime


# ── Nurse Call ───────────────────────────────────────────────────────────────

class NurseCallOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    room_id: uuid.UUID
    status: str
    called_at: datetime
    accepted_at: datetime | None = None
    en_route_at: datetime | None = None
    on_site_at: datetime | None = None
    resolved_at: datetime | None = None
    accepted_by_name: str | None = None
    resolved_by_name: str | None = None
    response_time_seconds: int | None = None
    notes: str | None = None
    created_at: datetime
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/monitoring.py
git commit -m "feat(monitoring): add Pydantic schemas for monitoring DTOs"
```

---

## Task 3: Backend Service

**Files:**
- Create: `backend/app/services/monitoring.py`

- [ ] **Step 1: Create MonitoringService**

Create `backend/app/services/monitoring.py`:

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/monitoring.py
git commit -m "feat(monitoring): add MonitoringService with CRUD, thresholds, alerts"
```

---

## Task 4: Backend REST API + WebSocket

**Files:**
- Create: `backend/app/api/v1/routes/monitoring.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create monitoring routes**

Create `backend/app/api/v1/routes/monitoring.py`:

```python
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.core.database import async_session_factory
from app.core.security import decode_token
from app.models.user import User
from app.schemas.monitoring import (
    CameraCreate, CameraUpdate, CameraOut,
    SensorCreate, SensorUpdate,
)
from app.services.monitoring import MonitoringService

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


# ── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, list[WebSocket]] = {}  # patient_id -> [ws, ...]

    async def connect(self, patient_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(patient_id, []).append(websocket)

    def disconnect(self, patient_id: str, websocket: WebSocket) -> None:
        conns = self.active.get(patient_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, patient_id: str, data: dict) -> None:
        for ws in self.active.get(patient_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


# ── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/{patient_id}/ws")
async def monitoring_ws(websocket: WebSocket, patient_id: uuid.UUID):
    """Real-time monitoring WebSocket. Auth via query param ?token=..."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    pid = str(patient_id)
    await manager.connect(pid, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "acknowledge_alert":
                async with async_session_factory() as session:
                    service = MonitoringService(session)
                    user_id = uuid.UUID(payload["sub"])
                    clinic_id = uuid.UUID(payload["clinic_id"])
                    alert = await service.acknowledge_alert(
                        uuid.UUID(data["alert_id"]), clinic_id, user_id,
                    )
                    await session.commit()
                    await manager.broadcast(pid, {
                        "type": "alert_update",
                        "alert_id": str(alert.id),
                        "status": alert.status.value,
                    })

            elif msg_type == "update_nurse_call":
                async with async_session_factory() as session:
                    service = MonitoringService(session)
                    user_id = uuid.UUID(payload["sub"])
                    clinic_id = uuid.UUID(payload["clinic_id"])
                    call = await service.update_nurse_call_status(
                        uuid.UUID(data["call_id"]), clinic_id, data["status"], user_id,
                    )
                    await session.commit()
                    await manager.broadcast(pid, {
                        "type": "nurse_call_update",
                        "call": _serialize_nurse_call(call),
                    })

    except WebSocketDisconnect:
        manager.disconnect(pid, websocket)
    except Exception:
        manager.disconnect(pid, websocket)


def _serialize_nurse_call(call) -> dict:
    return {
        "id": str(call.id),
        "status": call.status.value,
        "called_at": call.called_at.isoformat() if call.called_at else None,
        "accepted_at": call.accepted_at.isoformat() if call.accepted_at else None,
        "en_route_at": call.en_route_at.isoformat() if call.en_route_at else None,
        "on_site_at": call.on_site_at.isoformat() if call.on_site_at else None,
        "resolved_at": call.resolved_at.isoformat() if call.resolved_at else None,
        "accepted_by_name": (
            f"{call.accepted_by.last_name} {call.accepted_by.first_name[0]}."
            if call.accepted_by else None
        ),
        "response_time_seconds": call.response_time_seconds,
    }


# ── REST: Cameras ────────────────────────────────────────────────────────────

@router.get("/{patient_id}/cameras")
async def get_cameras(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    room_id = await service._get_patient_room_id(patient_id, current_user.clinic_id)
    if not room_id:
        return []
    cameras = await service.get_cameras(room_id, current_user.clinic_id)
    return [
        {
            "id": c.id, "room_id": c.room_id, "name": c.name,
            "camera_type": c.camera_type.value, "stream_url": c.stream_url,
            "is_active": c.is_active, "position_order": c.position_order,
        }
        for c in cameras
    ]


@router.post("/cameras", status_code=201)
async def create_camera(data: CameraCreate, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    camera = await service.create_camera(current_user.clinic_id, data.model_dump())
    return {"id": camera.id, "name": camera.name}


@router.patch("/cameras/{camera_id}")
async def update_camera(
    camera_id: uuid.UUID, data: CameraUpdate, session: DBSession, current_user: CurrentUser,
):
    service = MonitoringService(session)
    camera = await service.update_camera(camera_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {"id": camera.id, "name": camera.name, "is_active": camera.is_active}


@router.delete("/cameras/{camera_id}", status_code=204)
async def delete_camera(camera_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    await service.delete_camera(camera_id, current_user.clinic_id)


# ── REST: Sensors ────────────────────────────────────────────────────────────

@router.get("/{patient_id}/sensors")
async def get_sensors(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    sensors = await service.get_sensors(patient_id, current_user.clinic_id)
    return [
        {
            "id": s.id, "room_id": s.room_id, "patient_id": s.patient_id,
            "device_type": s.device_type.value, "device_category": s.device_category.value,
            "name": s.name, "is_active": s.is_active,
            "last_reading_at": s.last_reading_at,
        }
        for s in sensors
    ]


@router.get("/{patient_id}/sensors/current")
async def get_current_readings(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    return await service.get_current_readings(patient_id, current_user.clinic_id)


@router.get("/{patient_id}/sensors/{sensor_id}/readings")
async def get_sensor_readings(
    patient_id: uuid.UUID, sensor_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
    hours: int = Query(24, ge=1, le=168),
):
    service = MonitoringService(session)
    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(hours=hours)
    readings = await service.get_sensor_readings(sensor_id, from_dt, now)
    return [
        {
            "value": r.value, "value_secondary": r.value_secondary,
            "value_text": r.value_text, "unit": r.unit,
            "recorded_at": r.recorded_at,
        }
        for r in readings
    ]


@router.post("/sensors", status_code=201)
async def create_sensor(data: SensorCreate, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    sensor = await service.create_sensor(current_user.clinic_id, data.model_dump())
    return {"id": sensor.id, "name": sensor.name}


@router.delete("/sensors/{sensor_id}", status_code=204)
async def delete_sensor(sensor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    await service.delete_sensor(sensor_id, current_user.clinic_id)


# ── REST: Alerts ─────────────────────────────────────────────────────────────

@router.get("/{patient_id}/alerts")
async def get_alerts(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = Query(None), severity: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    service = MonitoringService(session)
    alerts = await service.get_alerts(
        patient_id, current_user.clinic_id, status=status, severity=severity, limit=limit,
    )
    return [
        {
            "id": a.id, "patient_id": a.patient_id, "alert_type": a.alert_type.value,
            "severity": a.severity.value, "title": a.title, "message": a.message,
            "status": a.status.value,
            "acknowledged_by_name": (
                f"{a.acknowledged_by.last_name} {a.acknowledged_by.first_name[0]}."
                if a.acknowledged_by else None
            ),
            "acknowledged_at": a.acknowledged_at,
            "resolved_by_name": (
                f"{a.resolved_by.last_name} {a.resolved_by.first_name[0]}."
                if a.resolved_by else None
            ),
            "resolved_at": a.resolved_at,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    alert = await service.acknowledge_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": alert.status.value}


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    alert = await service.resolve_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": alert.status.value}


# ── REST: Nurse Calls ────────────────────────────────────────────────────────

@router.get("/{patient_id}/nurse-calls")
async def get_nurse_calls(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = Query(None), limit: int = Query(20, ge=1, le=100),
):
    service = MonitoringService(session)
    calls = await service.get_nurse_calls(
        patient_id, current_user.clinic_id, status=status, limit=limit,
    )
    return [_serialize_nurse_call(c) | {"created_at": c.created_at} for c in calls]


@router.post("/{patient_id}/nurse-calls", status_code=201)
async def create_nurse_call(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    room_id = await service._get_patient_room_id(patient_id, current_user.clinic_id)
    if not room_id:
        from app.core.exceptions import ValidationError
        raise ValidationError("Пациент не размещён в палате")
    call = await service.create_nurse_call(current_user.clinic_id, patient_id, room_id)
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/accept")
async def accept_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "ACCEPTED", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/en-route")
async def en_route_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "EN_ROUTE", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/on-site")
async def on_site_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "ON_SITE", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/resolve")
async def resolve_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "RESOLVED", current_user.id,
    )
    return _serialize_nurse_call(call)
```

- [ ] **Step 2: Register monitoring router**

Add to `backend/app/api/v1/router.py`:

Import:
```python
from app.api.v1.routes import ..., monitoring
```

Include:
```python
api_router.include_router(monitoring.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/monitoring.py backend/app/api/v1/router.py
git commit -m "feat(monitoring): add REST API + WebSocket endpoint"
```

---

## Task 5: Backend Mock Data Simulator

**Files:**
- Create: `backend/app/services/monitoring_simulator.py`

- [ ] **Step 1: Create simulator**

Create `backend/app/services/monitoring_simulator.py`:

```python
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
```

- [ ] **Step 2: Start simulator in app lifespan**

In `backend/app/main.py`, add to the lifespan function after the migrations block:

```python
from app.services.monitoring_simulator import start_simulator, stop_simulator

# Inside lifespan, after yield setup:
start_simulator()
yield
stop_simulator()
```

Note: adjust the lifespan context manager so `start_simulator()` is called before `yield` and `stop_simulator()` is called after `yield`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/monitoring_simulator.py backend/app/main.py
git commit -m "feat(monitoring): add real-time mock data simulator with WS broadcast"
```

---

## Task 6: Backend Seed Script

**Files:**
- Create: `backend/seed_monitoring.py`

- [ ] **Step 1: Create seed script**

Create `backend/seed_monitoring.py`:

```python
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
```

- [ ] **Step 2: Run seed**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
python seed_monitoring.py
```

Expected: cameras, sensors, ~2000 readings per sensor, alerts, and nurse calls created.

- [ ] **Step 3: Commit**

```bash
git add backend/seed_monitoring.py
git commit -m "feat(monitoring): add seed script for cameras, sensors, historical data"
```

---

## Task 7: Frontend Types + API Client + Thresholds

**Files:**
- Create: `frontend/src/features/monitoring/types.ts`
- Create: `frontend/src/features/monitoring/thresholds.ts`
- Create: `frontend/src/features/monitoring/api.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/features/monitoring/types.ts`:

```typescript
export type DeviceType =
  | "HEART_RATE" | "SPO2" | "BODY_TEMPERATURE" | "BLOOD_PRESSURE"
  | "FALL_DETECTOR" | "ROOM_TEMPERATURE" | "HUMIDITY" | "MOTION" | "DOOR" | "NURSE_CALL";

export type DeviceCategory = "WEARABLE" | "STATIONARY";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
export type NurseCallStatus = "CALLED" | "ACCEPTED" | "EN_ROUTE" | "ON_SITE" | "RESOLVED";
export type CameraType = "OVERVIEW" | "BEDSIDE" | "ENTRANCE" | "OTHER";

export type Camera = {
  id: string;
  room_id: string;
  name: string;
  camera_type: CameraType;
  stream_url: string | null;
  is_active: boolean;
  position_order: number;
};

export type SensorReading = {
  sensor_id: string;
  device_type: DeviceType;
  device_category: DeviceCategory;
  name: string;
  value: number | null;
  value_secondary: number | null;
  value_text: string | null;
  unit: string;
  recorded_at: string | null;
  severity: "NORMAL" | "WARNING" | "CRITICAL";
};

export type Alert = {
  id: string;
  patient_id: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type NurseCall = {
  id: string;
  patient_id: string;
  room_id: string;
  status: NurseCallStatus;
  called_at: string;
  accepted_at: string | null;
  en_route_at: string | null;
  on_site_at: string | null;
  resolved_at: string | null;
  accepted_by_name: string | null;
  resolved_by_name: string | null;
  response_time_seconds: number | null;
};

export type ReadingPoint = {
  value: number | null;
  value_secondary: number | null;
  value_text: string | null;
  unit: string;
  recorded_at: string;
};

export type WsMessage =
  | { type: "sensor_update"; sensor_id: string; device_type: DeviceType; value: number | null; value_secondary: number | null; value_text: string | null; unit: string; severity: string; timestamp: string }
  | { type: "alert"; alert: Alert }
  | { type: "alert_update"; alert_id: string; status: AlertStatus }
  | { type: "nurse_call_update"; call: NurseCall };
```

- [ ] **Step 2: Create thresholds**

Create `frontend/src/features/monitoring/thresholds.ts`:

```typescript
import type { DeviceType } from "./types";

type SensorMeta = {
  label: string;
  unit: string;
  icon: string;       // short label for compact view
  format: (v: number | null, v2?: number | null) => string;
  colorNormal: string;
  colorWarning: string;
  colorCritical: string;
};

export const SENSOR_META: Partial<Record<DeviceType, SensorMeta>> = {
  HEART_RATE: {
    label: "Пульс", unit: "уд/мин", icon: "♥",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  SPO2: {
    label: "SpO2", unit: "%", icon: "O₂",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  BODY_TEMPERATURE: {
    label: "Темп. тела", unit: "°C", icon: "🌡",
    format: (v) => v != null ? v.toFixed(1) : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  BLOOD_PRESSURE: {
    label: "Давление", unit: "мм рт.ст.", icon: "♡",
    format: (v, v2) => v != null && v2 != null ? `${Math.round(v)}/${Math.round(v2)}` : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  FALL_DETECTOR: {
    label: "Падение", unit: "", icon: "⚠",
    format: (_v, _v2) => "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  ROOM_TEMPERATURE: {
    label: "Палата", unit: "°C", icon: "🏠",
    format: (v) => v != null ? v.toFixed(1) : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  HUMIDITY: {
    label: "Влажность", unit: "%", icon: "💧",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  MOTION: {
    label: "Движение", unit: "", icon: "👁",
    format: (_v, _v2) => "—",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  DOOR: {
    label: "Дверь", unit: "", icon: "🚪",
    format: (_v, _v2) => "—",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
};

export function getSeverityColor(severity: string, meta: SensorMeta): string {
  if (severity === "CRITICAL") return meta.colorCritical;
  if (severity === "WARNING") return meta.colorWarning;
  return meta.colorNormal;
}
```

- [ ] **Step 3: Create API client**

Create `frontend/src/features/monitoring/api.ts`:

```typescript
import apiClient from "@/lib/api-client";

export const monitoringApi = {
  // Cameras
  getCameras: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/cameras`).then((r) => r.data),

  // Sensors
  getSensors: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/sensors`).then((r) => r.data),

  getCurrentReadings: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/sensors/current`).then((r) => r.data),

  getSensorReadings: (patientId: string, sensorId: string, hours = 24) =>
    apiClient.get(`/monitoring/${patientId}/sensors/${sensorId}/readings?hours=${hours}`).then((r) => r.data),

  // Alerts
  getAlerts: (patientId: string, params?: { status?: string; severity?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/monitoring/${patientId}/alerts?${q}`).then((r) => r.data);
  },
  acknowledgeAlert: (alertId: string) =>
    apiClient.patch(`/monitoring/alerts/${alertId}/acknowledge`).then((r) => r.data),
  resolveAlert: (alertId: string) =>
    apiClient.patch(`/monitoring/alerts/${alertId}/resolve`).then((r) => r.data),

  // Nurse Calls
  getNurseCalls: (patientId: string, params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/monitoring/${patientId}/nurse-calls?${q}`).then((r) => r.data);
  },
  createNurseCall: (patientId: string) =>
    apiClient.post(`/monitoring/${patientId}/nurse-calls`).then((r) => r.data),
  acceptNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/accept`).then((r) => r.data),
  enRouteNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/en-route`).then((r) => r.data),
  onSiteNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/on-site`).then((r) => r.data),
  resolveNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/resolve`).then((r) => r.data),
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/monitoring/
git commit -m "feat(monitoring): add frontend types, thresholds, API client"
```

---

## Task 8: Frontend WebSocket Hook + Alert Sound

**Files:**
- Create: `frontend/src/features/monitoring/use-monitoring-ws.ts`
- Create: `frontend/src/features/monitoring/alert-sound.ts`

- [ ] **Step 1: Create alert sound utility**

Create `frontend/src/features/monitoring/alert-sound.ts`:

```typescript
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(frequency: number, duration: number, volume = 0.3): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

export function playWarningSound(): void {
  beep(880, 200);
}

export function playCriticalSound(): void {
  beep(1200, 150);
  setTimeout(() => beep(1200, 150), 250);
  setTimeout(() => beep(1200, 150), 500);
}

let criticalInterval: ReturnType<typeof setInterval> | null = null;

export function startCriticalAlarm(): void {
  if (criticalInterval) return;
  playCriticalSound();
  criticalInterval = setInterval(playCriticalSound, 10000);
}

export function stopCriticalAlarm(): void {
  if (criticalInterval) {
    clearInterval(criticalInterval);
    criticalInterval = null;
  }
}
```

- [ ] **Step 2: Create WebSocket hook**

Create `frontend/src/features/monitoring/use-monitoring-ws.ts`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WsMessage } from "./types";
import { playCriticalSound, playWarningSound } from "./alert-sound";

const WS_BASE = window.location.protocol === "https:" ? "wss:" : "ws:";

export function useMonitoringWS(patientId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const url = `${WS_BASE}//${window.location.host}/api/v1/monitoring/${patientId}/ws?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

      if (msg.type === "sensor_update") {
        // Update current readings cache
        queryClient.setQueryData(
          ["monitoring-readings", patientId],
          (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((r) =>
              r.sensor_id === msg.sensor_id
                ? { ...r, value: msg.value, value_secondary: msg.value_secondary, value_text: msg.value_text, severity: msg.severity, recorded_at: msg.timestamp }
                : r,
            );
          },
        );

        // Sound for critical
        if (msg.severity === "CRITICAL") {
          playCriticalSound();
        } else if (msg.severity === "WARNING") {
          playWarningSound();
        }
      }

      if (msg.type === "alert") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
        if (msg.alert.severity === "CRITICAL") {
          playCriticalSound();
          toast.error(msg.alert.title, { description: msg.alert.message, duration: 15000 });
        } else {
          playWarningSound();
          toast.warning(msg.alert.title, { description: msg.alert.message });
        }
      }

      if (msg.type === "alert_update") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
      }

      if (msg.type === "nurse_call_update") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [patientId, queryClient]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/monitoring/use-monitoring-ws.ts frontend/src/features/monitoring/alert-sound.ts
git commit -m "feat(monitoring): add WebSocket hook with auto-reconnect + alert sounds"
```

---

## Task 9: Frontend Monitoring Tab Page

**Files:**
- Create: `frontend/src/routes/_authenticated/patients.$patientId/monitoring.tsx`
- Modify: `frontend/src/routes/_authenticated/patients.$patientId.tsx`

This is the largest task. The page contains: alert banner, sensor cards (wearable), camera grid, room sensors, nurse call card, alert log, and trend charts.

- [ ] **Step 1: Add tab to patient layout**

In `frontend/src/routes/_authenticated/patients.$patientId.tsx`, add to the TABS array after the `rooms` entry:

```typescript
{ path: "monitoring", label: "Мониторинг", icon: MonitorIcon },
```

Add the `MonitorIcon` component (inline SVG, like the others):

```typescript
function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
```

- [ ] **Step 2: Create monitoring page component**

Create `frontend/src/routes/_authenticated/patients.$patientId/monitoring.tsx`.

This is a large file (~800 lines). It should be structured as:
1. Route definition + imports
2. Main `MonitoringPage` component
3. Sub-components: `AlertBanner`, `WearableSensorsRow`, `CameraGrid`, `RoomSensorsRow`, `NurseCallCard`, `AlertLog`, `TrendCharts`

The full implementation should follow all existing design patterns:
- `createFileRoute("/_authenticated/patients/$patientId/monitoring")`
- `useQuery` for data fetching with keys like `["monitoring-cameras", patientId]`
- `useMutation` for alert acknowledge/resolve and nurse call actions
- `useMonitoringWS(patientId)` for real-time updates
- Design system classes: `bg-[var(--color-surface)] rounded-2xl border border-border`, `animate-float-up`, skeleton loading
- Recharts `AreaChart` with `ResponsiveContainer` for trends
- `Badge` component for statuses
- `toast` from sonner for notifications

Key sections:

**AlertBanner**: fixed top banner when CRITICAL alerts active, red pulsing, with "Подтвердить" button.

**WearableSensorsRow**: horizontal row of cards for HEART_RATE, SPO2, BODY_TEMPERATURE, BLOOD_PRESSURE, FALL_DETECTOR. Each card shows value + unit + severity color. Uses `SENSOR_META` from thresholds.ts.

**CameraGrid**: CSS grid — main camera (grid-row: 1/3, grid-column: 1) takes 60% width, other cameras stacked on the right. Click to swap main. Each camera shows placeholder div with name and LIVE indicator.

**RoomSensorsRow**: compact row for ROOM_TEMPERATURE, HUMIDITY, MOTION, DOOR.

**NurseCallCard**: shows current active call status with timeline dots (CALLED → ACCEPTED → EN_ROUTE → ON_SITE → RESOLVED), timer since called_at, action buttons for the next status transition.

**AlertLog**: table with columns: Время, Тип, Severity, Статус, Действия. Filter by severity dropdown. "Подтвердить" / "Закрыть" buttons. Uses `<Badge>` for severity.

**TrendCharts**: period selector (1ч, 6ч, 24ч, 7д). For each wearable sensor type, a small `AreaChart` with gradient fill. Query `getSensorReadings` per sensor.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/monitoring.tsx frontend/src/routes/_authenticated/patients.\$patientId.tsx
git commit -m "feat(monitoring): add monitoring tab with cameras, sensors, alerts, nurse calls, trends"
```

---

## Task 10: Deploy to Railway

**Files:** None (deployment only)

- [ ] **Step 1: Commit any remaining changes**

```bash
git status
# If any uncommitted changes:
git add -A && git commit -m "chore: finalize monitoring feature"
```

- [ ] **Step 2: Deploy backend**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
railway up --service Backend --detach
```

Wait for SUCCESS. Check:
```bash
railway service Backend && railway deployment list | head -3
```

- [ ] **Step 3: Run migration on prod**

The backend auto-runs migrations on startup (see `main.py` lifespan).

Verify tables exist:
```bash
railway run -- python -c "from app.models.monitoring import *; print('Models OK')"
```

- [ ] **Step 4: Seed monitoring data on prod**

```bash
railway run -- python seed_monitoring.py
```

- [ ] **Step 5: Deploy frontend**

```bash
cd /Users/azamat/Desktop/telemed-v2-super/frontend
railway up --service Frontend --detach
```

Wait for SUCCESS:
```bash
railway service Frontend && railway deployment list | head -3
```

- [ ] **Step 6: Verify**

Open the patient card on production, navigate to the "Мониторинг" tab. Confirm:
- Camera placeholders visible in grid layout
- Sensor cards show mock values updating in real-time
- Alert log displays historical alerts
- Nurse call card renders
- Trend charts load with 7 days of data
