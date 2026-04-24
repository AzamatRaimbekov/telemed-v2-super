import uuid
from sqlalchemy import String, Float, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantMixin


class ReferralCode(Base, TenantMixin):
    __tablename__ = "referral_codes"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Float, default=10)
    referrer_bonus_percent: Mapped[float] = mapped_column(Float, default=5)
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReferralUse(Base, TenantMixin):
    __tablename__ = "referral_uses"
    code_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("referral_codes.id"), nullable=False)
    referred_patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0)
    bonus_amount: Mapped[float] = mapped_column(Float, default=0)
