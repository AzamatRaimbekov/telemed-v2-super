from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class PlacementType(str, enum.Enum):
    EMERGENCY_ROOM = "emergency_room"
    ICU = "icu"
    WARD = "ward"
    DAY_HOSPITAL = "day_hospital"
    ISOLATION = "isolation"
    OPERATING_ROOM = "operating_room"


class TransferCondition(str, enum.Enum):
    STABLE = "stable"
    IMPROVED = "improved"
    DETERIORATED = "deteriorated"
    CRITICAL = "critical"


class RoomAssignment(TenantMixin, Base):
    __tablename__ = "room_assignments"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    hospitalization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False)
    bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)

    placement_type: Mapped[Optional[PlacementType]] = mapped_column(Enum(PlacementType, values_callable=lambda e: [x.value for x in e]), nullable=True)

    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    transfer_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    transferred_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    condition_on_transfer: Mapped[Optional[TransferCondition]] = mapped_column(Enum(TransferCondition, values_callable=lambda e: [x.value for x in e]), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    department = relationship("Department", lazy="selectin")
    room = relationship("Room", lazy="selectin")
    bed = relationship("Bed", lazy="selectin")
    transferred_by_user = relationship("User", foreign_keys=[transferred_by], lazy="selectin")
