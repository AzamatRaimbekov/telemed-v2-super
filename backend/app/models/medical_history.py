from typing import Optional
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class HistoryEntryType(str, enum.Enum):
    INITIAL_EXAM = "initial_exam"
    DAILY_NOTE = "daily_note"
    SPECIALIST_CONSULT = "specialist_consult"
    PROCEDURE_NOTE = "procedure_note"
    DISCHARGE_SUMMARY = "discharge_summary"
    ANAMNESIS = "anamnesis"
    SURGERY_NOTE = "surgery_note"
    LAB_INTERPRETATION = "lab_interpretation"
    IMAGING_DESCRIPTION = "imaging_description"
    AI_GENERATED = "ai_generated"
    MANUAL = "manual"


class SourceType(str, enum.Enum):
    MANUAL = "manual"
    AI_FROM_PHOTO = "ai_from_photo"
    AI_FROM_AUDIO = "ai_from_audio"
    AI_GENERATED = "ai_generated"


class MedicalHistoryEntry(TenantMixin, Base):
    __tablename__ = "medical_history_entries"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    hospitalization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    entry_type: Mapped[HistoryEntryType] = mapped_column(
        Enum(HistoryEntryType, values_callable=lambda e: [x.value for x in e]),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    source_type: Mapped[Optional[SourceType]] = mapped_column(
        Enum(SourceType, values_callable=lambda e: [x.value for x in e]),
        nullable=True,
    )
    source_document_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ai_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)

    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    linked_diagnosis_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    linked_lab_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    linked_procedure_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    author = relationship("User", foreign_keys=[author_id], lazy="selectin")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
