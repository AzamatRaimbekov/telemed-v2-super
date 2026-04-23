from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FiscalRegisterRequest(BaseModel):
    payment_id: uuid.UUID
    amount: float = Field(..., gt=0)
    description: str = "Медицинские услуги"


class FiscalReceiptOut(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID | None = None
    receipt_number: str | None = None
    fiscal_sign: str | None = None
    fiscal_document_number: str | None = None
    fn_serial: str | None = None
    receipt_url: str | None = None
    amount: float
    status: str
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
