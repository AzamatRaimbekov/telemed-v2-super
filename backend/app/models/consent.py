import uuid
import enum
from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ConsentType(str, enum.Enum):
    TREATMENT = "treatment"
    SURGERY = "surgery"
    ANESTHESIA = "anesthesia"
    DATA_PROCESSING = "data_processing"
    RESEARCH = "research"
    DISCHARGE = "discharge"


class ConsentStatus(str, enum.Enum):
    PENDING = "pending"
    SIGNED = "signed"
    DECLINED = "declined"
    REVOKED = "revoked"


class PatientConsent(Base, TenantMixin):
    __tablename__ = "patient_consents"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    consent_type: Mapped[str] = mapped_column(SAEnum(ConsentType), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(ConsentStatus), default=ConsentStatus.PENDING)
    signed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 of signature image
    signed_ip: Mapped[str | None] = mapped_column(String(50), nullable=True)
    witness_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
