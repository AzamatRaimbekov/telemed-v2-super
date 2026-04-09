import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    CLINIC_ADMIN = "CLINIC_ADMIN"
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"
    PHARMACIST = "PHARMACIST"
    RECEPTIONIST = "RECEPTIONIST"
    LAB_TECHNICIAN = "LAB_TECHNICIAN"
    PATIENT = "PATIENT"
    GUARDIAN = "GUARDIAN"

class PermissionAction(str, enum.Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MANAGE = "MANAGE"

class User(TenantMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    specialization: Mapped[str | None] = mapped_column(String(255))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", use_alter=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class Role(TenantMixin, Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    permissions = relationship("RolePermission", back_populates="role", lazy="selectin")

class Permission(TenantMixin, Base):
    __tablename__ = "permissions"
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[PermissionAction] = mapped_column(Enum(PermissionAction), nullable=False)

class RolePermission(TenantMixin, Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False)
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission")
