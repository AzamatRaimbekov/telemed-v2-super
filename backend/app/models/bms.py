from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


# ── Enums ──────────────────────────────────────────────────────────────

class BmsRoomType(str, enum.Enum):
    WARD = "WARD"
    CORRIDOR = "CORRIDOR"
    SERVER = "SERVER"
    TECHNICAL = "TECHNICAL"
    OFFICE = "OFFICE"
    OPERATING = "OPERATING"
    LAB = "LAB"
    RECEPTION = "RECEPTION"
    PHARMACY = "PHARMACY"
    STORAGE = "STORAGE"
    BATHROOM = "BATHROOM"
    KITCHEN = "KITCHEN"
    OTHER = "OTHER"


class BmsSensorType(str, enum.Enum):
    TEMPERATURE = "TEMPERATURE"
    HUMIDITY = "HUMIDITY"
    CO2 = "CO2"
    LIGHT = "LIGHT"
    SMOKE = "SMOKE"
    WATER_LEAK = "WATER_LEAK"
    MOTION = "MOTION"
    DOOR_SENSOR = "DOOR_SENSOR"
    POWER_METER = "POWER_METER"
    PIPE_TEMPERATURE = "PIPE_TEMPERATURE"


class EquipmentType(str, enum.Enum):
    AC = "AC"
    HEATER = "HEATER"
    LIGHT = "LIGHT"
    VENTILATION = "VENTILATION"
    DOOR_LOCK = "DOOR_LOCK"
    ELEVATOR = "ELEVATOR"
    PUMP = "PUMP"
    GENERATOR = "GENERATOR"
    UPS = "UPS"
    OTHER = "OTHER"


class EquipmentStatus(str, enum.Enum):
    ON = "ON"
    OFF = "OFF"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"
    STANDBY = "STANDBY"


class EquipmentCommandType(str, enum.Enum):
    TURN_ON = "TURN_ON"
    TURN_OFF = "TURN_OFF"
    SET_PARAMETER = "SET_PARAMETER"
    RESTART = "RESTART"


class CommandStatus(str, enum.Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


class BmsAlertType(str, enum.Enum):
    HIGH_TEMPERATURE = "HIGH_TEMPERATURE"
    LOW_TEMPERATURE = "LOW_TEMPERATURE"
    HIGH_HUMIDITY = "HIGH_HUMIDITY"
    LOW_HUMIDITY = "LOW_HUMIDITY"
    HIGH_CO2 = "HIGH_CO2"
    SMOKE_DETECTED = "SMOKE_DETECTED"
    WATER_LEAK = "WATER_LEAK"
    POWER_OUTAGE = "POWER_OUTAGE"
    EQUIPMENT_ERROR = "EQUIPMENT_ERROR"
    DOOR_FORCED = "DOOR_FORCED"
    MOTION_AFTER_HOURS = "MOTION_AFTER_HOURS"
    SENSOR_OFFLINE = "SENSOR_OFFLINE"
    PIPE_FREEZE_RISK = "PIPE_FREEZE_RISK"


class BmsAlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    EMERGENCY = "EMERGENCY"


class BmsAlertStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    AUTO_RESOLVED = "AUTO_RESOLVED"


class ConditionOperator(str, enum.Enum):
    GT = "GT"
    LT = "LT"
    EQ = "EQ"
    GTE = "GTE"
    LTE = "LTE"


# ── Models ─────────────────────────────────────────────────────────────

class Building(TenantMixin, Base):
    __tablename__ = "bms_buildings"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    total_floors: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Floor(TenantMixin, Base):
    __tablename__ = "bms_floors"

    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_buildings.id"), nullable=False, index=True)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    grid_cols: Mapped[int] = mapped_column(Integer, default=8)
    grid_rows: Mapped[int] = mapped_column(Integer, default=6)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    building = relationship("Building", lazy="selectin")


class Zone(TenantMixin, Base):
    __tablename__ = "bms_zones"

    floor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_floors.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#3B82F6")

    floor = relationship("Floor", lazy="selectin")


class BmsRoom(TenantMixin, Base):
    __tablename__ = "bms_rooms"

    floor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_floors.id"), nullable=False, index=True)
    zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_zones.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    room_type: Mapped[BmsRoomType] = mapped_column(Enum(BmsRoomType), nullable=False)
    grid_x: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_y: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_w: Mapped[int] = mapped_column(Integer, default=1)
    grid_h: Mapped[int] = mapped_column(Integer, default=1)
    linked_room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)

    floor = relationship("Floor", lazy="selectin")
    zone = relationship("Zone", lazy="selectin")


class BmsSensor(TenantMixin, Base):
    __tablename__ = "bms_sensors"

    bms_room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_rooms.id"), nullable=False, index=True)
    floor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_floors.id"), nullable=False, index=True)
    sensor_type: Mapped[BmsSensorType] = mapped_column(Enum(BmsSensorType), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_value_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_reading_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    grid_x_offset: Mapped[float] = mapped_column(Float, default=0.5)
    grid_y_offset: Mapped[float] = mapped_column(Float, default=0.5)

    room = relationship("BmsRoom", lazy="selectin")
    floor = relationship("Floor", lazy="selectin")


class BmsSensorReading(Base):
    __tablename__ = "bms_sensor_readings"
    __table_args__ = (
        Index("ix_bms_sensor_readings_sensor_time", "sensor_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_sensors.id"), nullable=False)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Equipment(TenantMixin, Base):
    __tablename__ = "bms_equipment"

    bms_room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_rooms.id"), nullable=False, index=True)
    equipment_type: Mapped[EquipmentType] = mapped_column(Enum(EquipmentType), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[EquipmentStatus] = mapped_column(Enum(EquipmentStatus), default=EquipmentStatus.OFF)
    parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_controllable: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status_change: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room = relationship("BmsRoom", lazy="selectin")


class EquipmentCommand(TenantMixin, Base):
    __tablename__ = "bms_equipment_commands"

    equipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_equipment.id"), nullable=False, index=True)
    command: Mapped[EquipmentCommandType] = mapped_column(Enum(EquipmentCommandType), nullable=False)
    parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    issued_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[CommandStatus] = mapped_column(Enum(CommandStatus), default=CommandStatus.PENDING)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    equipment = relationship("Equipment", lazy="selectin")
    issued_by = relationship("User", lazy="selectin")


class BmsAlert(TenantMixin, Base):
    __tablename__ = "bms_alerts"

    floor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_floors.id"), nullable=True)
    bms_room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_rooms.id"), nullable=True)
    sensor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_sensors.id"), nullable=True)
    equipment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_equipment.id"), nullable=True)
    alert_type: Mapped[BmsAlertType] = mapped_column(Enum(BmsAlertType), nullable=False)
    severity: Mapped[BmsAlertSeverity] = mapped_column(Enum(BmsAlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[BmsAlertStatus] = mapped_column(Enum(BmsAlertStatus), default=BmsAlertStatus.ACTIVE)
    acknowledged_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    floor = relationship("Floor", lazy="selectin")
    room = relationship("BmsRoom", lazy="selectin")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")


class AutomationRule(TenantMixin, Base):
    __tablename__ = "bms_automation_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    condition_sensor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_operator: Mapped[ConditionOperator] = mapped_column(Enum(ConditionOperator), nullable=False)
    condition_value: Mapped[float] = mapped_column(Float, nullable=False)
    condition_floor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_floors.id"), nullable=True)
    condition_room_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_rooms.id"), nullable=True)
    action_equipment_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    action_equipment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_equipment.id"), nullable=True)
    action_command: Mapped[str] = mapped_column(String(50), nullable=False)
    action_parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    schedule_cron: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    schedule_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)


class AutomationLog(Base):
    __tablename__ = "bms_automation_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bms_automation_rules.id"), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sensor_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    action_taken: Mapped[str] = mapped_column(String(500), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
