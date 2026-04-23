import uuid
import enum
from datetime import date
from sqlalchemy import String, Integer, Float, Date, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ConsumableCategory(str, enum.Enum):
    SYRINGES = "syringes"
    GLOVES = "gloves"
    BANDAGES = "bandages"
    NEEDLES = "needles"
    CATHETERS = "catheters"
    MASKS = "masks"
    GOWNS = "gowns"
    DISINFECTANT = "disinfectant"
    SUTURES = "sutures"
    OTHER = "other"


class ConsumableItem(Base, TenantMixin):
    __tablename__ = "consumable_items"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(SAEnum(ConsumableCategory), default=ConsumableCategory.OTHER)
    unit: Mapped[str] = mapped_column(String(20), default="шт")  # шт, уп, л, мл
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    min_quantity: Mapped[int] = mapped_column(Integer, default=10)
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    supplier: Mapped[str | None] = mapped_column(String(200), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)  # "Склад A, Полка 3"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConsumableUsage(Base, TenantMixin):
    __tablename__ = "consumable_usages"
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consumable_items.id"), nullable=False)
    used_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    quantity_used: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
