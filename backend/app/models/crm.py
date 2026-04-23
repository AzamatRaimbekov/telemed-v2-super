import uuid
import enum
from sqlalchemy import String, Text, Float, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin

class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    APPOINTMENT_BOOKED = "appointment_booked"
    VISITED = "visited"
    CONVERTED = "converted"
    LOST = "lost"

class LeadSource(str, enum.Enum):
    WEBSITE = "website"
    PHONE = "phone"
    WALK_IN = "walk_in"
    REFERRAL = "referral"
    SOCIAL_MEDIA = "social_media"
    WHATSAPP = "whatsapp"
    ADVERTISEMENT = "advertisement"

class CRMLead(Base, TenantMixin):
    __tablename__ = "crm_leads"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source: Mapped[str] = mapped_column(SAEnum(LeadSource), default=LeadSource.PHONE)
    status: Mapped[str] = mapped_column(SAEnum(LeadStatus), default=LeadStatus.NEW)
    interested_in: Mapped[str | None] = mapped_column(String(300), nullable=True)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
