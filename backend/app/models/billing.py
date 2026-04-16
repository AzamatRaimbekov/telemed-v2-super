from typing import Optional
import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"

class InsuranceClaimStatus(str, enum.Enum):
    NONE = "NONE"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class InvoiceItemType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    PROCEDURE = "PROCEDURE"
    LAB_TEST = "LAB_TEST"
    MEDICATION = "MEDICATION"
    ROOM = "ROOM"
    OTHER = "OTHER"

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    INSURANCE = "INSURANCE"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"

class Invoice(TenantMixin, Base):
    __tablename__ = "invoices"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    treatment_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    insurance_claim_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    insurance_claim_status: Mapped[InsuranceClaimStatus] = mapped_column(Enum(InsuranceClaimStatus), default=InsuranceClaimStatus.NONE)
    foms_claim_number: Mapped[Optional[str]] = mapped_column(String(100))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    items = relationship("InvoiceItem", back_populates="invoice", lazy="selectin")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")

class InvoiceItem(TenantMixin, Base):
    __tablename__ = "invoice_items"
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    item_type: Mapped[InvoiceItemType] = mapped_column(Enum(InvoiceItemType), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    invoice = relationship("Invoice", back_populates="items")

class Payment(TenantMixin, Base):
    __tablename__ = "payments"
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(255))
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    received_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    invoice = relationship("Invoice", back_populates="payments")
    received_by = relationship("User", foreign_keys=[received_by_id], lazy="selectin")
