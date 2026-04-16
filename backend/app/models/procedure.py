from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class ProcedureOrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Procedure(TenantMixin, Base):
    __tablename__ = "procedures"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(100))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    requires_consent: Mapped[bool] = mapped_column(Boolean, default=False)

class ProcedureOrder(TenantMixin, Base):
    __tablename__ = "procedure_orders"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    procedure_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("procedures.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    performed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    treatment_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    status: Mapped[ProcedureOrderStatus] = mapped_column(Enum(ProcedureOrderStatus), default=ProcedureOrderStatus.ORDERED)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    consent_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    procedure = relationship("Procedure", foreign_keys=[procedure_id], lazy="selectin")
    ordered_by = relationship("User", foreign_keys=[ordered_by_id], lazy="selectin")
    performed_by = relationship("User", foreign_keys=[performed_by_id], lazy="selectin")
