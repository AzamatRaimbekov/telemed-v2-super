import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class TelemedicineSessionStatus(str, enum.Enum):
    WAITING = "WAITING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TelemedicineSession(TenantMixin, Base):
    __tablename__ = "telemedicine_sessions"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    room_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    status: Mapped[TelemedicineSessionStatus] = mapped_column(Enum(TelemedicineSessionStatus), default=TelemedicineSessionStatus.WAITING)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    patient_questionnaire: Mapped[dict | None] = mapped_column(JSON)
    doctor_notes: Mapped[str | None] = mapped_column(Text)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")

class Message(TenantMixin, Base):
    __tablename__ = "messages"
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attachment_url: Mapped[str | None] = mapped_column(String(500))
    sender = relationship("User", foreign_keys=[sender_id], lazy="selectin")
    recipient = relationship("User", foreign_keys=[recipient_id], lazy="selectin")
