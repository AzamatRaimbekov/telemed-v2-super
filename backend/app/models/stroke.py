from typing import Optional
import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Enum, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class AssessmentType(str, enum.Enum):
    NIHSS = "NIHSS"
    MRS = "MRS"
    BARTHEL = "BARTHEL"
    MMSE = "MMSE"
    BECK_DEPRESSION = "BECK_DEPRESSION"
    DYSPHAGIA = "DYSPHAGIA"

class RehabDomain(str, enum.Enum):
    MOBILITY = "MOBILITY"
    SPEECH = "SPEECH"
    COGNITION = "COGNITION"
    ADL = "ADL"
    PSYCHOLOGICAL = "PSYCHOLOGICAL"
    SOCIAL = "SOCIAL"

class RehabGoalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACHIEVED = "ACHIEVED"
    PARTIALLY_ACHIEVED = "PARTIALLY_ACHIEVED"
    NOT_ACHIEVED = "NOT_ACHIEVED"
    REVISED = "REVISED"

class StrokeAssessment(TenantMixin, Base):
    __tablename__ = "stroke_assessments"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    assessed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assessment_type: Mapped[AssessmentType] = mapped_column(Enum(AssessmentType), nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    max_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    responses: Mapped[Optional[dict]] = mapped_column(JSON)
    interpretation: Mapped[Optional[str]] = mapped_column(Text)
    assessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    assessed_by = relationship("User", foreign_keys=[assessed_by_id], lazy="selectin")

class RehabGoal(TenantMixin, Base):
    __tablename__ = "rehab_goals"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    treatment_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    domain: Mapped[RehabDomain] = mapped_column(Enum(RehabDomain), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    target_date: Mapped[Optional[date]] = mapped_column(Date)
    baseline_value: Mapped[Optional[str]] = mapped_column(String(255))
    target_value: Mapped[Optional[str]] = mapped_column(String(255))
    current_value: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[RehabGoalStatus] = mapped_column(Enum(RehabGoalStatus), default=RehabGoalStatus.ACTIVE)
    set_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    set_by = relationship("User", foreign_keys=[set_by_id], lazy="selectin")
    progress_records = relationship("RehabProgress", back_populates="goal", lazy="selectin")

class RehabProgress(TenantMixin, Base):
    __tablename__ = "rehab_progress"
    goal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rehab_goals.id"), nullable=False)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    recorded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    goal = relationship("RehabGoal", back_populates="progress_records")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id], lazy="selectin")
