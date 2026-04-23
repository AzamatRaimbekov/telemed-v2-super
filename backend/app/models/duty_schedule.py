import uuid
import enum
from datetime import date, time
from sqlalchemy import String, Date, Time, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class DutyType(str, enum.Enum):
    DAY = "day"         # дневное
    NIGHT = "night"     # ночное
    FULL = "full"       # суточное (24ч)
    ON_CALL = "on_call" # на вызове


class DutyScheduleEntry(Base, TenantMixin):
    __tablename__ = "duty_schedule_entries"

    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    duty_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    duty_type: Mapped[str] = mapped_column(SAEnum(DutyType), nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
