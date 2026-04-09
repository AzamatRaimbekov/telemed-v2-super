import enum
import uuid
from datetime import date, time
from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class ShiftType(str, enum.Enum):
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    NIGHT = "NIGHT"
    ON_CALL = "ON_CALL"

class ShiftStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ABSENT = "ABSENT"

class StaffSchedule(TenantMixin, Base):
    __tablename__ = "staff_schedules"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    is_available: Mapped[bool] = mapped_column(Integer, default=True)
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

class Shift(TenantMixin, Base):
    __tablename__ = "shifts"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    shift_date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    shift_type: Mapped[ShiftType] = mapped_column(Enum(ShiftType), nullable=False)
    status: Mapped[ShiftStatus] = mapped_column(Enum(ShiftStatus), default=ShiftStatus.SCHEDULED)
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

class Attendance(TenantMixin, Base):
    __tablename__ = "attendance"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    clock_in: Mapped[str | None] = mapped_column(String(50))
    clock_out: Mapped[str | None] = mapped_column(String(50))
    qr_code: Mapped[str | None] = mapped_column(String(500))
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2))
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
