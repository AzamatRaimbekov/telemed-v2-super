import uuid
import enum
from datetime import date
from sqlalchemy import String, Text, Float, Date, Boolean, JSON, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class InsuranceCompany(Base, TenantMixin):
    __tablename__ = "insurance_companies"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    contract_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contract_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    discount_percent: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    covered_services: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # ["consultation", "lab", "imaging", "pharmacy", "surgery"]


class InsurancePolicy(Base, TenantMixin):
    __tablename__ = "insurance_policies"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("insurance_companies.id"), nullable=False)
    policy_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    coverage_type: Mapped[str] = mapped_column(String(50), default="standard")  # standard, premium, vip
    max_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    used_amount: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InsuranceClaim(Base, TenantMixin):
    __tablename__ = "insurance_claims"
    policy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("insurance_policies.id"), nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    claim_amount: Mapped[float] = mapped_column(Float, nullable=False)
    approved_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, approved, rejected, paid
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
