import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, JSON, Enum as SAEnum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class EquipmentType(str, enum.Enum):
    VENTILATOR = "ventilator"     # ИВЛ
    PATIENT_MONITOR = "patient_monitor"
    INFUSION_PUMP = "infusion_pump"  # Инфузомат
    DEFIBRILLATOR = "defibrillator"
    ECG_MACHINE = "ecg_machine"
    XRAY = "xray"
    ULTRASOUND = "ultrasound"
    CT_SCANNER = "ct_scanner"
    MRI = "mri"
    LAB_ANALYZER = "lab_analyzer"
    AUTOCLAVE = "autoclave"       # Стерилизатор
    OTHER = "other"


class EquipmentStatus(str, enum.Enum):
    OPERATIONAL = "operational"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    OFFLINE = "offline"
    DECOMMISSIONED = "decommissioned"


class MedicalEquipment(Base, TenantMixin):
    __tablename__ = "medical_equipment"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    equipment_type: Mapped[str] = mapped_column(SAEnum(EquipmentType), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(EquipmentStatus), default=EquipmentStatus.OPERATIONAL)
    last_maintenance: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_maintenance: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hours_used: Mapped[int] = mapped_column(Integer, default=0)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)


class EquipmentReading(Base, TenantMixin):
    __tablename__ = "equipment_readings"
    equipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("medical_equipment.id"), nullable=False)
    reading_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g. "temperature", "pressure", "flow_rate", "battery", "error_code"
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    string_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_alert: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
