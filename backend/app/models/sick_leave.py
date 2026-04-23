import uuid
import enum
from datetime import date
from sqlalchemy import String, Text, Date, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class SickLeaveStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    EXTENDED = "extended"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class SickLeave(Base, TenantMixin):
    __tablename__ = "sick_leaves"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    diagnosis_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    diagnosis_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    extension_days: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(SAEnum(SickLeaveStatus), default=SickLeaveStatus.DRAFT)
    employer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
