from __future__ import annotations
import enum
import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, BaseMixin, TenantMixin


class ModelTier(str, enum.Enum):
    FAST = "fast"
    POWERFUL = "powerful"


class AIProvider(BaseMixin, Base):
    __tablename__ = "ai_providers"
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_env: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=10)
    rate_limit: Mapped[int] = mapped_column(Integer, default=1000)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AIPromptTemplate(BaseMixin, Base):
    __tablename__ = "ai_prompt_templates"
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    user_prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    model_tier: Mapped[ModelTier] = mapped_column(
        Enum(ModelTier, values_callable=lambda e: [x.value for x in e]),
        default=ModelTier.FAST,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AIUsageLog(TenantMixin, Base):
    __tablename__ = "ai_usage_log"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider_used: Mapped[str] = mapped_column(String(50), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)


class AIGeneratedContent(TenantMixin, Base):
    __tablename__ = "ai_generated_content"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    output_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    accepted_by_doctor: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
