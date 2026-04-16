from typing import Optional
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, BaseMixin


class PermissionGroup(BaseMixin, Base):
    __tablename__ = "permission_groups"

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    label_ru: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(40))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    permissions = relationship("PermissionItem", back_populates="group", lazy="selectin")


class PermissionItem(BaseMixin, Base):
    __tablename__ = "permission_items"

    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_groups.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    label_ru: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    group = relationship("PermissionGroup", back_populates="permissions")


class PermissionTemplate(TenantMixin, Base):
    __tablename__ = "permission_templates"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(7))
    icon_initials: Mapped[Optional[str]] = mapped_column(String(3))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    template_permissions = relationship("TemplatePermission", back_populates="template", lazy="selectin", cascade="all, delete-orphan")
    extra_fields = relationship("TemplateExtraField", back_populates="template", lazy="selectin", cascade="all, delete-orphan")


class TemplatePermission(Base):
    __tablename__ = "template_permissions"

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_templates.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_items.id"), primary_key=True)

    template = relationship("PermissionTemplate", back_populates="template_permissions")
    permission = relationship("PermissionItem", lazy="selectin")


class TemplateExtraField(TenantMixin, Base):
    __tablename__ = "template_extra_fields"

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_templates.id"), nullable=False)
    field_key: Mapped[str] = mapped_column(String(60), nullable=False)
    label_ru: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)  # text|number|date|select|multiselect|boolean
    options: Mapped[Optional[dict]] = mapped_column(JSON)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    template = relationship("PermissionTemplate", back_populates="extra_fields")


class UserTemplate(Base):
    __tablename__ = "user_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_templates.id"), nullable=False)
    assigned_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    template = relationship("PermissionTemplate", lazy="selectin")


class UserPermissionOverride(TenantMixin, Base):
    __tablename__ = "user_permission_overrides"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permission_items.id"), nullable=False)
    is_granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    permission = relationship("PermissionItem", lazy="selectin")
