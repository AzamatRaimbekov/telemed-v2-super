import uuid
from datetime import date
from sqlalchemy import String, Text, Date, Boolean, JSON, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ChecklistTemplate(Base, TenantMixin):
    __tablename__ = "checklist_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="nursing")  # nursing, infection, surgery_prep, discharge
    items: Mapped[dict] = mapped_column(JSON, nullable=False)
    # [{"id": "1", "text": "Измерить температуру", "required": true}, ...]
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class ChecklistInstance(Base, TenantMixin):
    __tablename__ = "checklist_instances"

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("checklist_templates.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    completed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    checklist_date: Mapped[date] = mapped_column(Date, nullable=False)
    responses: Mapped[dict] = mapped_column(JSON, nullable=False)
    # {"1": {"checked": true, "note": ""}, "2": {"checked": false, "note": "Пациент отказался"}}
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    completion_percent: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
