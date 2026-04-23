import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class LabQueueStatus(str, enum.Enum):
    WAITING = "waiting"
    CALLED = "called"
    COLLECTING = "collecting"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class LabQueueEntry(Base, TenantMixin):
    __tablename__ = "lab_queue_entries"

    queue_number: Mapped[int] = mapped_column(Integer, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    lab_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(LabQueueStatus), default=LabQueueStatus.WAITING)
    window_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
