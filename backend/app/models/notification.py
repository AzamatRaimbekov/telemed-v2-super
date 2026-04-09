import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class NotificationType(str, enum.Enum):
    PATIENT_ASSIGNED = "PATIENT_ASSIGNED"
    LAB_RESULT_READY = "LAB_RESULT_READY"
    MEDICATION_DUE = "MEDICATION_DUE"
    APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER"
    LOW_STOCK = "LOW_STOCK"
    TREATMENT_UPDATED = "TREATMENT_UPDATED"
    ABNORMAL_RESULT = "ABNORMAL_RESULT"
    ALLERGY_ALERT = "ALLERGY_ALERT"
    SYSTEM = "SYSTEM"

class NotificationSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class Notification(TenantMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[NotificationSeverity] = mapped_column(Enum(NotificationSeverity), default=NotificationSeverity.INFO)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reference_type: Mapped[str | None] = mapped_column(String(100))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    data: Mapped[dict | None] = mapped_column(JSON)
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
