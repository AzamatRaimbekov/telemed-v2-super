import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class RoomType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    WARD = "WARD"
    ICU = "ICU"
    OPERATING = "OPERATING"
    LAB = "LAB"
    PHARMACY = "PHARMACY"
    RECEPTION = "RECEPTION"
    OTHER = "OTHER"

class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"
    RESERVED = "RESERVED"

class Department(TenantMixin, Base):
    __tablename__ = "departments"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    head_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    head = relationship("User", foreign_keys=[head_id], lazy="selectin")
    rooms = relationship("Room", back_populates="department", lazy="selectin")

class Room(TenantMixin, Base):
    __tablename__ = "rooms"
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    room_number: Mapped[str | None] = mapped_column(String(50))
    room_type: Mapped[RoomType] = mapped_column(Enum(RoomType), nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer)
    floor: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    department = relationship("Department", back_populates="rooms")
    beds = relationship("Bed", back_populates="room", lazy="selectin")

class Bed(TenantMixin, Base):
    __tablename__ = "beds"
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False)
    bed_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[BedStatus] = mapped_column(Enum(BedStatus), default=BedStatus.AVAILABLE)
    room = relationship("Room", back_populates="beds")
    assignments = relationship("BedAssignment", back_populates="bed", lazy="selectin")

class BedAssignment(TenantMixin, Base):
    __tablename__ = "bed_assignments"
    bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    bed = relationship("Bed", back_populates="assignments")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
