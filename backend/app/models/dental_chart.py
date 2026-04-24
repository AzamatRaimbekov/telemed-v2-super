import uuid
import enum
from sqlalchemy import String, Float, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ToothStatus(str, enum.Enum):
    HEALTHY = "healthy"
    CARIES = "caries"
    FILLED = "filled"
    CROWN = "crown"
    IMPLANT = "implant"
    MISSING = "missing"
    ROOT_CANAL = "root_canal"
    BRIDGE = "bridge"
    VENEER = "veneer"
    TEMPORARY = "temporary"
    PLANNED = "planned"


class DentalChart(Base, TenantMixin):
    __tablename__ = "dental_charts"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False
    )
    teeth: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # Format: {"11": {"status": "healthy", "notes": "", "treatments": []}, ...}
    # Teeth numbered 11-18, 21-28, 31-38, 41-48 (FDI notation)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ToothTreatment(Base, TenantMixin):
    __tablename__ = "tooth_treatments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    tooth_number: Mapped[int] = mapped_column(Integer, nullable=False)  # FDI: 11-48
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    procedure_name: Mapped[str] = mapped_column(String(200), nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(String(300), nullable=True)
    tooth_status_before: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tooth_status_after: Mapped[str] = mapped_column(String(20), nullable=False)
    materials_used: Mapped[str | None] = mapped_column(String(500), nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
