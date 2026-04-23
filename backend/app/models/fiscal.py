import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class FiscalStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class FiscalReceipt(TenantMixin, Base):
    __tablename__ = "fiscal_receipts"

    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True
    )
    receipt_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fiscal_sign: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fiscal_document_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fn_serial: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    receipt_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[FiscalStatus] = mapped_column(
        Enum(FiscalStatus), default=FiscalStatus.PENDING, nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    payment = relationship("Payment", foreign_keys=[payment_id], lazy="selectin")
