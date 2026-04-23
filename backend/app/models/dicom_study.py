import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, JSON, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class StudyStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    ARCHIVED = "archived"


class Modality(str, enum.Enum):
    CR = "CR"    # рентген
    CT = "CT"    # КТ
    MR = "MR"    # МРТ
    US = "US"    # УЗИ
    XA = "XA"    # ангиография
    MG = "MG"    # маммография
    DX = "DX"    # цифровой рентген
    OTHER = "OTHER"


class DicomStudy(Base, TenantMixin):
    __tablename__ = "dicom_studies"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    referring_doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    radiologist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    study_instance_uid: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    accession_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    modality: Mapped[str] = mapped_column(SAEnum(Modality), nullable=False)
    study_description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    body_part: Mapped[str | None] = mapped_column(String(100), nullable=True)
    study_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    series_count: Mapped[int] = mapped_column(Integer, default=1)
    image_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(SAEnum(StudyStatus), default=StudyStatus.UPLOADED)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_conclusion: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
