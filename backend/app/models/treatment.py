import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class TreatmentPlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TreatmentItemType(str, enum.Enum):
    MEDICATION = "MEDICATION"
    PROCEDURE = "PROCEDURE"
    LAB_TEST = "LAB_TEST"
    THERAPY = "THERAPY"
    EXERCISE = "EXERCISE"
    DIET = "DIET"
    MONITORING = "MONITORING"

class TreatmentItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TreatmentPlan(TenantMixin, Base):
    __tablename__ = "treatment_plans"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TreatmentPlanStatus] = mapped_column(Enum(TreatmentPlanStatus), default=TreatmentPlanStatus.DRAFT)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    visit = relationship("Visit", foreign_keys=[visit_id], lazy="selectin")
    items = relationship("TreatmentPlanItem", back_populates="treatment_plan", lazy="selectin")

class TreatmentPlanItem(TenantMixin, Base):
    __tablename__ = "treatment_plan_items"
    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=False)
    item_type: Mapped[TreatmentItemType] = mapped_column(Enum(TreatmentItemType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    configuration: Mapped[dict | None] = mapped_column(JSON)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    frequency: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[TreatmentItemStatus] = mapped_column(Enum(TreatmentItemStatus), default=TreatmentItemStatus.PENDING)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    treatment_plan = relationship("TreatmentPlan", back_populates="items")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="selectin")
