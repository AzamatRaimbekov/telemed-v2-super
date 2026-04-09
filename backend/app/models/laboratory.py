import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class LabOrderPriority(str, enum.Enum):
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"
    STAT = "STAT"

class LabOrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    SAMPLE_COLLECTED = "SAMPLE_COLLECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class LabResultStatus(str, enum.Enum):
    PRELIMINARY = "PRELIMINARY"
    FINAL = "FINAL"
    AMENDED = "AMENDED"

class LabTestCatalog(TenantMixin, Base):
    __tablename__ = "lab_test_catalog"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    reference_ranges: Mapped[dict | None] = mapped_column(JSON)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    turnaround_hours: Mapped[int | None] = mapped_column(Integer)
    sample_type: Mapped[str | None] = mapped_column(String(100))

class LabOrder(TenantMixin, Base):
    __tablename__ = "lab_orders"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    test_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_catalog.id"), nullable=False)
    priority: Mapped[LabOrderPriority] = mapped_column(Enum(LabOrderPriority), default=LabOrderPriority.ROUTINE)
    status: Mapped[LabOrderStatus] = mapped_column(Enum(LabOrderStatus), default=LabOrderStatus.ORDERED)
    notes: Mapped[str | None] = mapped_column(Text)
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    ordered_by = relationship("User", foreign_keys=[ordered_by_id], lazy="selectin")
    collected_by = relationship("User", foreign_keys=[collected_by_id], lazy="selectin")
    test = relationship("LabTestCatalog", foreign_keys=[test_id], lazy="selectin")
    result = relationship("LabResult", back_populates="lab_order", uselist=False, lazy="selectin")

class LabResult(TenantMixin, Base):
    __tablename__ = "lab_results"
    lab_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    value: Mapped[str | None] = mapped_column(String(500))
    numeric_value: Mapped[float | None] = mapped_column(Numeric(12, 4))
    unit: Mapped[str | None] = mapped_column(String(50))
    reference_range: Mapped[str | None] = mapped_column(String(255))
    is_abnormal: Mapped[bool] = mapped_column(Boolean, default=False)
    visible_to_patient: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    attachment_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[LabResultStatus] = mapped_column(Enum(LabResultStatus), default=LabResultStatus.PRELIMINARY)
    resulted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lab_order = relationship("LabOrder", back_populates="result")
    performed_by = relationship("User", foreign_keys=[performed_by_id], lazy="selectin")
    approved_by = relationship("User", foreign_keys=[approved_by_id], lazy="selectin")
