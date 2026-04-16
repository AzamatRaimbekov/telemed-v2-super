from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.schemas.billing import (
    BillingStatsOut,
    InvoiceCreate,
    InvoiceOut,
    InvoiceUpdate,
    PaymentCreate,
    PaymentOut,
)
from app.services.billing import BillingService

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Invoices ──────────────────────────────────────────────────────────────────


@router.get("/invoices")
async def list_invoices(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = BillingService(session)
    items, total = await service.get_invoices(
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return {"items": items, "total": total}


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    return await service.get_invoice(invoice_id, current_user.clinic_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    return await service.create_invoice(current_user.clinic_id, data)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    return await service.update_invoice(invoice_id, current_user.clinic_id, data)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    await service.delete_invoice(invoice_id, current_user.clinic_id)


# ── Payments ──────────────────────────────────────────────────────────────────


@router.post("/payments", response_model=PaymentOut, status_code=201)
async def record_payment(
    data: PaymentCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    return await service.record_payment(
        clinic_id=current_user.clinic_id,
        user_id=current_user.id,
        data=data,
    )


@router.get("/payments")
async def list_payments(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = BillingService(session)
    items, total = await service.get_payments(
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        skip=skip,
        limit=limit,
    )
    return {"items": items, "total": total}


# ── Stats ─────────────────────────────────────────────────────────────────────


@router.get("/stats", response_model=BillingStatsOut)
async def billing_stats(
    session: DBSession,
    current_user: CurrentUser,
):
    service = BillingService(session)
    return await service.get_billing_stats(current_user.clinic_id)
