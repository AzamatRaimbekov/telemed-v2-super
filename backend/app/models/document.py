from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class DocumentCategory(str, enum.Enum):
    LAB_RESULT = "lab_result"
    IMAGING = "imaging"
    PRESCRIPTION = "prescription"
    DISCHARGE = "discharge"
    CONSENT = "consent"
    REFERRAL = "referral"
    INSURANCE = "insurance"
    IDENTITY = "identity"
    OTHER = "other"


class Document(TenantMixin, Base):
    __tablename__ = "documents"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[DocumentCategory] = mapped_column(
        Enum(DocumentCategory, values_callable=lambda e: [x.value for x in e]),
        default=DocumentCategory.OTHER,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id], lazy="selectin")
