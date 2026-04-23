import uuid
from typing import Optional

from sqlalchemy import String, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class TreatmentTemplate(TenantMixin, Base):
    __tablename__ = "treatment_templates"

    icd10_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    icd10_name: Mapped[str] = mapped_column(String(300), nullable=False)
    template_name: Mapped[str] = mapped_column(String(200), nullable=False)
    medications: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"name": "Аспирин", "dosage": "100мг", "frequency": "1 раз/день", "duration": "30 дней"}]
    procedures: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"name": "ЭКГ", "frequency": "при поступлении"}, {"name": "ОАК", "frequency": "ежедневно"}]
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diet: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
