import uuid
import enum
from datetime import date
from sqlalchemy import String, Text, Date, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class IsolationType(str, enum.Enum):
    CONTACT = "contact"
    DROPLET = "droplet"
    AIRBORNE = "airborne"
    PROTECTIVE = "protective"


class InfectionStatus(str, enum.Enum):
    SUSPECTED = "suspected"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    MONITORING = "monitoring"


class InfectionRecord(Base, TenantMixin):
    __tablename__ = "infection_records"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    reported_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    infection_type: Mapped[str] = mapped_column(String(200), nullable=False)  # COVID-19, MRSA, etc.
    isolation_type: Mapped[str] = mapped_column(SAEnum(IsolationType), default=IsolationType.CONTACT)
    status: Mapped[str] = mapped_column(SAEnum(InfectionStatus), default=InfectionStatus.SUSPECTED)
    detected_date: Mapped[date] = mapped_column(Date, nullable=False)
    resolved_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    precautions: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_trace: Mapped[str | None] = mapped_column(Text, nullable=True)  # who was in contact
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
