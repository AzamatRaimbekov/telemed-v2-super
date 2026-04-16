from typing import Optional
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class StaffProfile(TenantMixin, Base):
    __tablename__ = "staff_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)

    # Personal
    last_name: Mapped[str] = mapped_column(String(60), nullable=False)
    first_name: Mapped[str] = mapped_column(String(40), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(40))
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    phone_personal: Mapped[Optional[str]] = mapped_column(String(20))
    email_personal: Mapped[Optional[str]] = mapped_column(String(255))
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Work — position is FREE TEXT
    position: Mapped[str] = mapped_column(String(200), nullable=False)
    position_level: Mapped[Optional[str]] = mapped_column(String(80))
    specialization: Mapped[Optional[str]] = mapped_column(String(200))
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    section: Mapped[Optional[str]] = mapped_column(String(100))
    employment_start: Mapped[date] = mapped_column(Date, nullable=False)
    employment_end: Mapped[Optional[date]] = mapped_column(Date)
    employment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # full|part|contractor|intern
    work_phone: Mapped[Optional[str]] = mapped_column(String(20))
    work_email: Mapped[Optional[str]] = mapped_column(String(255))
    office_room: Mapped[Optional[str]] = mapped_column(String(50))
    max_patients: Mapped[Optional[int]] = mapped_column(Integer)
    work_schedule: Mapped[Optional[str]] = mapped_column(String(50))

    # Dynamic fields
    qualifications: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    extra_fields: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # Salary
    salary_type: Mapped[Optional[str]] = mapped_column(String(20))
    salary_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    hourly_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    bank_details: Mapped[Optional[str]] = mapped_column(Text)

    user = relationship("User", lazy="selectin")
    department = relationship("Department", lazy="selectin")
