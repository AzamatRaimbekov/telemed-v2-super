from typing import Optional
import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, func
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
    PARTIALLY_DISPENSED = "PARTIALLY_DISPENSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class InventoryOperationType(str, enum.Enum):
    RECEIPT = "RECEIPT"
    DISPENSE = "DISPENSE"
    WRITE_OFF = "WRITE_OFF"
    ADJUSTMENT = "ADJUSTMENT"


class WriteOffReason(str, enum.Enum):
    EXPIRED = "EXPIRED"
    DAMAGED = "DAMAGED"
    LOST = "LOST"
    OTHER = "OTHER"

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
    generic_name: Mapped[Optional[str]] = mapped_column(String(255))
    brand: Mapped[Optional[str]] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    form: Mapped[DrugForm] = mapped_column(Enum(DrugForm), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=True)
    interactions: Mapped[Optional[dict]] = mapped_column(JSON)
    contraindications: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Prescription(TenantMixin, Base):
    __tablename__ = "prescriptions"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    treatment_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    status: Mapped[PrescriptionStatus] = mapped_column(Enum(PrescriptionStatus), default=PrescriptionStatus.ACTIVE)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    prescribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    items = relationship("PrescriptionItem", back_populates="prescription", lazy="selectin")

class PrescriptionItem(TenantMixin, Base):
    __tablename__ = "prescription_items"
    prescription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    dosage: Mapped[Optional[str]] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    route: Mapped[RouteOfAdministration] = mapped_column(Enum(RouteOfAdministration), default=RouteOfAdministration.ORAL)
    duration_days: Mapped[Optional[int]] = mapped_column(Integer)
    quantity: Mapped[Optional[int]] = mapped_column(Integer)
    is_prn: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    prescription = relationship("Prescription", back_populates="items")
    drug = relationship("Drug", foreign_keys=[drug_id], lazy="selectin")

class Supplier(TenantMixin, Base):
    __tablename__ = "suppliers"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)

class Inventory(TenantMixin, Base):
    __tablename__ = "inventory"
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    batch_number: Mapped[Optional[str]] = mapped_column(String(100))
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    purchase_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    drug = relationship("Drug", foreign_keys=[drug_id], lazy="selectin")
    supplier = relationship("Supplier", foreign_keys=[supplier_id], lazy="selectin")

class PurchaseOrder(TenantMixin, Base):
    __tablename__ = "purchase_orders"
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    ordered_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT)
    total_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ordered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    supplier = relationship("Supplier", foreign_keys=[supplier_id], lazy="selectin")
    ordered_by = relationship("User", foreign_keys=[ordered_by_id], lazy="selectin")
    order_items = relationship("PurchaseOrderItem", back_populates="purchase_order", lazy="selectin")


class InventoryLog(TenantMixin, Base):
    __tablename__ = "inventory_logs"
    inventory_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory.id"), nullable=False)
    operation_type: Mapped[InventoryOperationType] = mapped_column(Enum(InventoryOperationType), nullable=False)
    quantity_change: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    performed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    performer = relationship("User", foreign_keys=[performed_by], lazy="selectin")
    inventory = relationship("Inventory", foreign_keys=[inventory_id], lazy="selectin")


class DispenseRecord(TenantMixin, Base):
    __tablename__ = "dispense_records"
    prescription_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prescription_items.id"), nullable=False)
    inventory_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    dispensed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    dispensed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    prescription_item = relationship("PrescriptionItem", foreign_keys=[prescription_item_id], lazy="selectin")
    inventory = relationship("Inventory", foreign_keys=[inventory_id], lazy="selectin")
    dispenser = relationship("User", foreign_keys=[dispensed_by], lazy="selectin")


class PurchaseOrderItem(TenantMixin, Base):
    __tablename__ = "purchase_order_items"
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    drug = relationship("Drug", foreign_keys=[drug_id], lazy="selectin")
    purchase_order = relationship("PurchaseOrder", back_populates="order_items")
