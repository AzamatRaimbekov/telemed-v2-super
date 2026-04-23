import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class SignatureStatus(str, enum.Enum):
    PENDING = "pending"
    SIGNED = "signed"
    REJECTED = "rejected"
    EXPIRED = "expired"


class DocumentSignature(TenantMixin, Base):
    __tablename__ = "document_signatures"

    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "prescription", "discharge", etc.
    document_title: Mapped[str] = mapped_column(String(300), nullable=False)
    signer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    signer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    signer_role: Mapped[str] = mapped_column(String(50), nullable=False)
    signature_hash: Mapped[str | None] = mapped_column(String(500), nullable=True)  # SHA-256 hash
    pin_code_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(SAEnum(SignatureStatus), default=SignatureStatus.PENDING)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    signer = relationship("User", foreign_keys=[signer_id], lazy="selectin")
