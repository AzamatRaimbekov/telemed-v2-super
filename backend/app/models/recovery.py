# backend/app/models/recovery.py
from typing import Optional
import enum
import uuid
from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class RecoveryDomain(str, enum.Enum):
    VITALS = "VITALS"
    LABS = "LABS"
    SCALES = "SCALES"
    EXERCISES = "EXERCISES"
    TREATMENT = "TREATMENT"


class RecoveryGoal(TenantMixin, Base):
    __tablename__ = "recovery_goals"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    domain: Mapped[RecoveryDomain] = mapped_column(Enum(RecoveryDomain), nullable=False)
    metric_key: Mapped[str] = mapped_column(String(100), nullable=False)
    target_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))
    set_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    set_by = relationship("User", foreign_keys=[set_by_id], lazy="selectin")


class RecoveryDomainWeight(TenantMixin, Base):
    __tablename__ = "recovery_domain_weights"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    domain: Mapped[RecoveryDomain] = mapped_column(Enum(RecoveryDomain), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    set_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    set_by = relationship("User", foreign_keys=[set_by_id], lazy="selectin")
