import uuid
from datetime import date
from sqlalchemy import String, Text, Float, Integer, Date, Boolean, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin

class CorporateContract(Base, TenantMixin):
    __tablename__ = "corporate_contracts"
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    max_employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    used_amount: Mapped[float] = mapped_column(Float, default=0)
    discount_percent: Mapped[float] = mapped_column(Float, default=0)
    covered_services: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

class CorporateEmployee(Base, TenantMixin):
    __tablename__ = "corporate_employees"
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("corporate_contracts.id"), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    employee_id_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
