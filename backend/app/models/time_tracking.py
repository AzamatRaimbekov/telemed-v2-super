import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin

class TimeEntry(Base, TenantMixin):
    __tablename__ = "time_entries"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hours_worked: Mapped[float | None] = mapped_column(Float, nullable=True)
    break_minutes: Mapped[float] = mapped_column(Float, default=0)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
