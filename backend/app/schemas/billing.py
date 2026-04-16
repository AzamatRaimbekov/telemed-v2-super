from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class InvoiceItemCreate(BaseModel):
    item_type: str = Field(..., description="CONSULTATION, PROCEDURE, LAB_TEST, MEDICATION, ROOM, OTHER")
    description: str
    quantity: float = 1
    unit_price: float
    reference_id: uuid.UUID | None = None


class InvoiceCreate(BaseModel):
    patient_id: uuid.UUID
    visit_id: uuid.UUID | None = None
    treatment_plan_id: uuid.UUID | None = None
    due_date: date | None = None
    notes: str | None = None
    discount: float = 0
    tax: float = 0
    insurance_claim_amount: float | None = None
    items: list[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    status: str | None = None
    due_date: date | None = None
    notes: str | None = None
    discount: float | None = None
    tax: float | None = None
    insurance_claim_amount: float | None = None
    insurance_claim_status: str | None = None


class PaymentCreate(BaseModel):
    invoice_id: uuid.UUID
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., description="CASH, CARD, INSURANCE, BANK_TRANSFER, OTHER")
    reference_number: str | None = None


class InvoiceItemOut(BaseModel):
    id: uuid.UUID
    item_type: str
    description: str
    quantity: float
    unit_price: float
    total_price: float

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    invoice_number: str
    status: str
    subtotal: float
    discount: float
    tax: float
    total: float
    insurance_claim_amount: float | None = None
    insurance_claim_status: str
    due_date: date | None = None
    notes: str | None = None
    issued_at: datetime | None = None
    created_at: datetime
    items: list[InvoiceItemOut] = []
    payments: list[dict] = []
    patient_name: str | None = None

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_method: str
    reference_number: str | None = None
    paid_at: datetime | None = None
    received_by_name: str | None = None

    model_config = {"from_attributes": True}


class BillingStatsOut(BaseModel):
    total_invoiced: float = 0
    total_paid: float = 0
    total_outstanding: float = 0
    total_overdue: float = 0
    invoice_count: int = 0
    paid_count: int = 0
    overdue_count: int = 0
