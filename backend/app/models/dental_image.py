import uuid
import enum
from sqlalchemy import String, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class DentalImageType(str, enum.Enum):
    PERIAPICAL = "periapical"           # прицельный
    PANORAMIC = "panoramic"             # ОПТГ
    BITEWING = "bitewing"               # интерпроксимальный
    CEPHALOMETRIC = "cephalometric"     # ТРГ
    CT_3D = "ct_3d"                     # КЛКТ
    PHOTO_INTRAORAL = "photo_intraoral"       # фото внутриротовое
    PHOTO_EXTRAORAL = "photo_extraoral"       # фото внеротовое
    PHOTO_BEFORE_AFTER = "photo_before_after"


class DentalImage(Base, TenantMixin):
    __tablename__ = "dental_images"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    image_type: Mapped[str] = mapped_column(String(30), nullable=False)
    tooth_numbers: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # "11,12,13" or null for panoramic
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_before_after: Mapped[bool] = mapped_column(Boolean, default=False)
    pair_image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # linked before/after
