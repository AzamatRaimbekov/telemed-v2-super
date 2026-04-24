import uuid
from sqlalchemy import String, Float, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class DentalProcedure(Base, TenantMixin):
    __tablename__ = "dental_procedures"

    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # categories: therapy, surgery, ortho, prosthetics, hygiene, endodontics, pediatric, implantology
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_price: Mapped[float] = mapped_column(Float, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
