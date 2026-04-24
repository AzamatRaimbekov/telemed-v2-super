import uuid
import enum
from datetime import date
from sqlalchemy import String, Date, Integer, Float, JSON, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class OrthoType(str, enum.Enum):
    BRACES_METAL = "braces_metal"
    BRACES_CERAMIC = "braces_ceramic"
    BRACES_SAPPHIRE = "braces_sapphire"
    BRACES_LINGUAL = "braces_lingual"
    ALIGNERS = "aligners"


class OrthoTreatment(Base, TenantMixin):
    __tablename__ = "ortho_treatments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    ortho_type: Mapped[str] = mapped_column(SAEnum(OrthoType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    estimated_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_visits_planned: Mapped[int] = mapped_column(Integer, default=24)
    visits_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    paid_amount: Mapped[float] = mapped_column(Float, default=0)
    aligner_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # for aligners
    current_aligner: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress_photos: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # [{date, image_url}]
