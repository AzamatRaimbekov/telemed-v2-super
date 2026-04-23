import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, DateTime, JSON, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class SurgeryStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class SurgeryProtocol(Base, TenantMixin):
    __tablename__ = "surgery_protocols"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    surgeon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assistant_ids: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    anesthesiologist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    surgery_name: Mapped[str] = mapped_column(String(300), nullable=False)
    surgery_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    anesthesia_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(SurgeryStatus), default=SurgeryStatus.PLANNED)
    planned_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    protocol_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    complications: Mapped[str | None] = mapped_column(Text, nullable=True)
    blood_loss_ml: Mapped[float | None] = mapped_column(Float, nullable=True)
    implants_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    postop_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
