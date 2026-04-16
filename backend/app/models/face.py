from typing import Optional
import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class FaceSnapshotSource(str, enum.Enum):
    CAMERA = "CAMERA"
    UPLOAD = "UPLOAD"
    PASSPORT = "PASSPORT"

class FaceSnapshot(TenantMixin, Base):
    __tablename__ = "face_snapshots"
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[FaceSnapshotSource] = mapped_column(Enum(FaceSnapshotSource), nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    embeddings = relationship("FaceEmbedding", back_populates="face_snapshot", lazy="selectin")

class FaceEmbedding(TenantMixin, Base):
    __tablename__ = "face_embeddings"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    face_snapshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("face_snapshots.id"), nullable=False)
    embedding: Mapped[Optional[dict]] = mapped_column(JSON)
    model_version: Mapped[Optional[str]] = mapped_column(String(100))
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    face_snapshot = relationship("FaceSnapshot", back_populates="embeddings")
