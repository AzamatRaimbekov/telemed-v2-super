import uuid
import enum
from sqlalchemy import String, Integer, Float, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, BaseMixin, TenantMixin


class PointsTransactionType(str, enum.Enum):
    EARNED = "earned"       # from visits, payments
    SPENT = "spent"         # redeemed for discount
    BONUS = "bonus"         # promotional bonus
    EXPIRED = "expired"


class LoyaltyAccount(TenantMixin, Base):
    __tablename__ = "loyalty_accounts"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False
    )
    balance: Mapped[int] = mapped_column(Integer, default=0)
    total_earned: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[str] = mapped_column(String(20), default="bronze")  # bronze, silver, gold, platinum


class PointsTransaction(TenantMixin, Base):
    __tablename__ = "points_transactions"
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_accounts.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # positive=earn, negative=spend
    transaction_type: Mapped[str] = mapped_column(SAEnum(PointsTransactionType), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # payment_id, appointment_id, etc.
