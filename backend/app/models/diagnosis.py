from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class DiagnosisStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    CHRONIC = "chronic"
    SUSPECTED = "suspected"
    RULED_OUT = "ruled_out"


class Diagnosis(TenantMixin, Base):
    __tablename__ = "diagnoses"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    icd_code: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[DiagnosisStatus] = mapped_column(
        Enum(DiagnosisStatus, values_callable=lambda e: [x.value for x in e]),
        default=DiagnosisStatus.ACTIVE,
    )
    diagnosed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    diagnosed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    diagnosed_by = relationship("User", foreign_keys=[diagnosed_by_id], lazy="selectin")
    visit = relationship("Visit", foreign_keys=[visit_id], lazy="selectin")
