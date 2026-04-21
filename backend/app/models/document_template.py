import uuid
import enum
from sqlalchemy import String, Text, Enum as SAEnum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class TemplateCategory(str, enum.Enum):
    PRESCRIPTION = "prescription"
    DISCHARGE = "discharge"
    REFERRAL = "referral"
    CERTIFICATE = "certificate"
    CONSENT = "consent"
    LAB_ORDER = "lab_order"
    OTHER = "other"


class DocumentTemplate(TenantMixin, Base):
    __tablename__ = "document_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(SAEnum(TemplateCategory), default=TemplateCategory.OTHER)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)  # Jinja2 template HTML
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
