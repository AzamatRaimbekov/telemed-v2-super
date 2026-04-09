import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class VisitType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    FOLLOW_UP = "FOLLOW_UP"
    EMERGENCY = "EMERGENCY"
    TELEMEDICINE = "TELEMEDICINE"
    PROCEDURE = "PROCEDURE"

class VisitStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"

class MedicalCard(TenantMixin, Base):
    __tablename__ = "medical_cards"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False)
    card_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    patient = relationship("Patient", back_populates="medical_card")
    visits = relationship("Visit", back_populates="medical_card", lazy="selectin")

class Visit(TenantMixin, Base):
    __tablename__ = "visits"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    medical_card_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("medical_cards.id"))
    visit_type: Mapped[VisitType] = mapped_column(Enum(VisitType), nullable=False)
    status: Mapped[VisitStatus] = mapped_column(Enum(VisitStatus), default=VisitStatus.SCHEDULED)
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    examination_notes: Mapped[str | None] = mapped_column(Text)
    diagnosis_codes: Mapped[dict | None] = mapped_column(JSON)
    diagnosis_text: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    medical_card = relationship("MedicalCard", back_populates="visits")
