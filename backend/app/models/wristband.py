import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class WristbandStatus(str, enum.Enum):
    ACTIVE = "active"
    DEACTIVATED = "deactivated"
    LOST = "lost"
    DISCHARGED = "discharged"


class PatientWristband(TenantMixin, Base):
    __tablename__ = "patient_wristbands"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    wristband_uid: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    # Format: MC-XXXXXX (6-char alphanumeric, uppercase)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)  # EAN-13 or Code128
    nfc_tag_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # NFC chip UID
    status: Mapped[str] = mapped_column(SAEnum(WristbandStatus), default=WristbandStatus.ACTIVE)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issued_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
