from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, BaseMixin, TenantMixin


# ── Enums ──────────────────────────────────────────────────────────────

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


# ── Models ─────────────────────────────────────────────────────────────

class RoomCamera(TenantMixin, Base):
    __tablename__ = "room_cameras"

    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stream_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    camera_type: Mapped[CameraType] = mapped_column(Enum(CameraType), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    position_order: Mapped[int] = mapped_column(Integer, default=0)

    room = relationship("Room", lazy="selectin")


class SensorDevice(TenantMixin, Base):
    __tablename__ = "sensor_devices"

    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True, index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True, index=True)
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType), nullable=False)
    device_category: Mapped[DeviceCategory] = mapped_column(Enum(DeviceCategory), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_reading_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room = relationship("Room", lazy="selectin")
    patient = relationship("Patient", lazy="selectin")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_sensor_readings_sensor_time", "sensor_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sensor_devices.id"), nullable=False)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_secondary: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MonitoringAlert(TenantMixin, Base):
    __tablename__ = "monitoring_alerts"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)
    sensor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sensor_devices.id"), nullable=True)
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), default=AlertStatus.ACTIVE)
    acknowledged_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", lazy="selectin")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")


class NurseCall(TenantMixin, Base):
    __tablename__ = "nurse_calls"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False)
    status: Mapped[NurseCallStatus] = mapped_column(Enum(NurseCallStatus), default=NurseCallStatus.CALLED)
    called_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    en_route_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    on_site_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    response_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient = relationship("Patient", lazy="selectin")
    accepted_by = relationship("User", foreign_keys=[accepted_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")
