import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, DateTime, JSON, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class SummaryStatus(str, enum.Enum):
    PROCESSING = "processing"
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class VisitSummary(TenantMixin, Base):
    __tablename__ = "visit_summaries"

    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    structured_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # structured_summary format:
    # {
    #   "chief_complaint": "...",
    #   "history_of_present_illness": "...",
    #   "examination": "...",
    #   "diagnosis": "...",
    #   "treatment_plan": "...",
    #   "recommendations": "...",
    #   "follow_up": "..."
    # }
    ai_model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(SummaryStatus), default=SummaryStatus.PROCESSING)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
