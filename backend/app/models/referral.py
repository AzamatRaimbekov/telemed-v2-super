import uuid
import enum
from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ReferralStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    COMPLETED = "completed"


class ReferralPriority(str, enum.Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class DoctorReferral(Base, TenantMixin):
    __tablename__ = "doctor_referrals"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    from_doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    to_specialty: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(SAEnum(ReferralPriority), default=ReferralPriority.ROUTINE)
    status: Mapped[str] = mapped_column(SAEnum(ReferralStatus), default=ReferralStatus.PENDING)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(String(300), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
