import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class DrugForm(str, enum.Enum):
    TABLET = "TABLET"
    CAPSULE = "CAPSULE"
    INJECTION = "INJECTION"
    SYRUP = "SYRUP"
    CREAM = "CREAM"
    DROPS = "DROPS"
    INHALER = "INHALER"
    OTHER = "OTHER"

class PrescriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISPENSED = "DISPENSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

class RouteOfAdministration(str, enum.Enum):
    ORAL = "ORAL"
    IV = "IV"
    IM = "IM"
    TOPICAL = "TOPICAL"
    SUBLINGUAL = "SUBLINGUAL"
    RECTAL = "RECTAL"
    INHALATION = "INHALATION"
    OTHER = "OTHER"

class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"

class Drug(TenantMixin, Base):
    __tablename__ = "drugs"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(255))
    brand: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(100))
    form: Mapped[DrugForm] = mapped_column(Enum(DrugForm), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50))
    price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=True)
    interactions: Mapped[dict | None] = mapped_column(JSON)
    contraindications: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Prescription(TenantMixin, Base):
    __tablename__ = "prescriptions"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    status: Mapped[PrescriptionStatus] = mapped_column(Enum(PrescriptionStatus), default=PrescriptionStatus.ACTIVE)
    notes: Mapped[str | None] = mapped_column(Text)
    prescribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    items = relationship("PrescriptionItem", back_populates="prescription", lazy="selectin")

class PrescriptionItem(TenantMixin, Base):
    __tablename__ = "prescription_items"
    prescription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(100))
    frequency: Mapped[str | None] = mapped_column(String(100))
    route: Mapped[RouteOfAdministration] = mapped_column(Enum(RouteOfAdministration), default=RouteOfAdministration.ORAL)
    duration_days: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[int | None] = mapped_column(Integer)
    is_prn: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    prescription = relationship("Prescription", back_populates="items")
    drug = relationship("Drug", foreign_keys=[drug_id], lazy="selectin")

class Supplier(TenantMixin, Base):
    __tablename__ = "suppliers"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)

class Inventory(TenantMixin, Base):
    __tablename__ = "inventory"
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    batch_number: Mapped[str | None] = mapped_column(String(100))
    expiry_date: Mapped[date | None] = mapped_column(Date)
    purchase_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    location: Mapped[str | None] = mapped_column(String(255))
    drug = relationship("Drug", foreign_keys=[drug_id], lazy="selectin")
    supplier = relationship("Supplier", foreign_keys=[supplier_id], lazy="selectin")

class PurchaseOrder(TenantMixin, Base):
    __tablename__ = "purchase_orders"
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    items: Mapped[dict | None] = mapped_column(JSON)
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supplier = relationship("Supplier", foreign_keys=[supplier_id], lazy="selectin")
    ordered_by = relationship("User", foreign_keys=[ordered_by_id], lazy="selectin")
