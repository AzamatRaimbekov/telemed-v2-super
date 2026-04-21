import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class QueueStatus(str, enum.Enum):
    WAITING = "waiting"
    CALLED = "called"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class QueueEntry(TenantMixin, Base):
    __tablename__ = "queue_entries"

    queue_number: Mapped[int] = mapped_column(Integer, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    status: Mapped[QueueStatus] = mapped_column(Enum(QueueStatus), default=QueueStatus.WAITING, nullable=False)
    room_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    called_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    appointment = relationship("Appointment", foreign_keys=[appointment_id], lazy="selectin")
