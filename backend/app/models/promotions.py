import uuid
import enum
from datetime import date
from sqlalchemy import String, Text, Float, Integer, Date, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin

class DiscountType(str, enum.Enum):
    PERCENT = "percent"
    FIXED = "fixed"

class Promotion(Base, TenantMixin):
    __tablename__ = "promotions"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[str] = mapped_column(SAEnum(DiscountType), nullable=False)
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)
    min_amount: Mapped[float] = mapped_column(Float, default=0)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    applicable_services: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
