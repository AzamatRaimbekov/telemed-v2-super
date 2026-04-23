from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.schemas.fiscal import FiscalReceiptOut, FiscalRegisterRequest
from app.services.fiscal_service import FiscalService

router = APIRouter(prefix="/fiscal", tags=["fiscal"])


@router.post("/register", response_model=FiscalReceiptOut, status_code=201)
async def register_receipt(
    data: FiscalRegisterRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = FiscalService(session)
    receipt = await service.register_receipt(
        payment_id=data.payment_id,
        amount=data.amount,
        clinic_id=current_user.clinic_id,
        description=data.description,
    )
    return receipt


@router.get("/receipts", response_model=list[FiscalReceiptOut])
async def list_receipts(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    service = FiscalService(session)
    return await service.list_receipts(
        clinic_id=current_user.clinic_id,
        status=status,
        limit=limit,
    )


@router.get("/receipts/{receipt_id}", response_model=FiscalReceiptOut)
async def get_receipt(
    receipt_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = FiscalService(session)
    receipt = await service.get_receipt(receipt_id)
    if not receipt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("FiscalReceipt")
    return receipt


@router.get("/payment/{payment_id}", response_model=FiscalReceiptOut)
async def get_receipt_by_payment(
    payment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = FiscalService(session)
    receipt = await service.get_by_payment(payment_id)
    if not receipt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("FiscalReceipt")
    return receipt


@router.post("/receipts/{receipt_id}/retry", response_model=FiscalReceiptOut)
async def retry_failed_receipt(
    receipt_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = FiscalService(session)
    receipt = await service.retry_failed(receipt_id)
    if not receipt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("FiscalReceipt")
    return receipt
