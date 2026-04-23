import uuid
import enum
from datetime import date
from sqlalchemy import String, Text, Date, Integer, JSON, Enum as SAEnum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class PrescriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    DISPENSED = "dispensed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class EPrescription(Base, TenantMixin):
    __tablename__ = "e_prescriptions"

    prescription_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    # Format: RX-XXXXXXXX (8 alphanumeric)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    diagnosis_code: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ICD-10
    diagnosis_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    medications: Mapped[dict] = mapped_column(JSON, nullable=False)
    # [{"name": "Аспирин", "dosage": "100мг", "frequency": "1 раз/день", "duration": "30 дней", "quantity": 30}]
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(PrescriptionStatus), default=PrescriptionStatus.ACTIVE)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    dispensed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    dispensed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    refill_count: Mapped[int] = mapped_column(Integer, default=0)
    max_refills: Mapped[int] = mapped_column(Integer, default=0)
