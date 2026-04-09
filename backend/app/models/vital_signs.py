import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class VitalSign(TenantMixin, Base):
    __tablename__ = "vital_signs"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    systolic_bp: Mapped[int | None] = mapped_column(Integer)
    diastolic_bp: Mapped[int | None] = mapped_column(Integer)
    pulse: Mapped[int | None] = mapped_column(Integer)
    temperature: Mapped[float | None] = mapped_column(Numeric(4, 1))
    weight: Mapped[float | None] = mapped_column(Numeric(5, 1))
    height: Mapped[float | None] = mapped_column(Numeric(5, 1))
    spo2: Mapped[int | None] = mapped_column(Integer)
    respiratory_rate: Mapped[int | None] = mapped_column(Integer)
    blood_glucose: Mapped[float | None] = mapped_column(Numeric(5, 2))
    notes: Mapped[str | None] = mapped_column(Text)
