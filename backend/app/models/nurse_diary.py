import uuid
from datetime import date
from sqlalchemy import String, Text, Date, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class NurseDiaryEntry(Base, TenantMixin):
    __tablename__ = "nurse_diary_entries"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    nurse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String(20), default="day")  # day, night, evening
    general_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)  # satisfactory, moderate, severe, critical
    consciousness: Mapped[str | None] = mapped_column(String(50), nullable=True)  # clear, confused, unconscious
    temperature: Mapped[str | None] = mapped_column(String(10), nullable=True)
    blood_pressure: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pulse: Mapped[str | None] = mapped_column(String(10), nullable=True)
    respiratory_rate: Mapped[str | None] = mapped_column(String(10), nullable=True)
    complaints: Mapped[str | None] = mapped_column(Text, nullable=True)
    procedures_done: Mapped[str | None] = mapped_column(Text, nullable=True)
    medications_given: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # [{name, dose, time}]
    diet: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
