from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.schemas.pharmacy import (
    AdjustRequest,
    DispenseRequest,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    ReceiveOrderRequest,
    SupplierCreate,
    SupplierUpdate,
    WriteOffRequest,
)
from app.services.pharmacy import PharmacyService

router = APIRouter(prefix="/pharmacy", tags=["Pharmacy"])


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/dashboard")
async def get_dashboard(session: DBSession, current_user: CurrentUser):
    service = PharmacyService(session)
    return await service.get_dashboard(current_user.clinic_id)


# ══════════════════════════════════════════════════════════════════════════════
# Inventory
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/inventory")
async def list_inventory(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
    form: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = PharmacyService(session)
    return await service.list_inventory(
        current_user.clinic_id, search, category, form, status, skip, limit
    )


@router.get("/inventory/{drug_id}/batches")
async def get_batches(
    drug_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.get_batches(current_user.clinic_id, drug_id)


@router.post("/inventory/write-off")
async def write_off(
    data: WriteOffRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.write_off(
        current_user.clinic_id, data.inventory_id, data.quantity, data.reason, current_user.id
    )


@router.post("/inventory/adjust")
async def adjust(
    data: AdjustRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.adjust(
        current_user.clinic_id, data.inventory_id, data.quantity, data.reason, current_user.id
    )


# ══════════════════════════════════════════════════════════════════════════════
# Dispensing
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/prescriptions")
async def get_prescription_queue(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    date_filter: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = PharmacyService(session)
    return await service.get_prescription_queue(
        current_user.clinic_id, search, date_filter, skip, limit
    )


@router.get("/prescriptions/{prescription_id}")
async def get_prescription_detail(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.get_prescription_detail(current_user.clinic_id, prescription_id)


@router.post("/prescriptions/{prescription_id}/dispense")
async def dispense(
    prescription_id: uuid.UUID,
    data: DispenseRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.dispense(
        current_user.clinic_id, prescription_id, data.items, current_user.id
    )


# ══════════════════════════════════════════════════════════════════════════════
# Purchase Orders
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/orders")
async def list_orders(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(None),
    supplier_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = PharmacyService(session)
    return await service.list_orders(
        current_user.clinic_id, status, supplier_id, skip, limit
    )


@router.get("/orders/{order_id}")
async def get_order(
    order_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.get_order(current_user.clinic_id, order_id)


@router.post("/orders", status_code=201)
async def create_order(
    data: PurchaseOrderCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.create_order(current_user.clinic_id, data, current_user.id)


@router.patch("/orders/{order_id}")
async def update_order(
    order_id: uuid.UUID,
    data: PurchaseOrderUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.update_order(current_user.clinic_id, order_id, data)


@router.post("/orders/{order_id}/submit")
async def submit_order(
    order_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.submit_order(current_user.clinic_id, order_id)


@router.post("/orders/{order_id}/receive")
async def receive_order(
    order_id: uuid.UUID,
    data: ReceiveOrderRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.receive_order(current_user.clinic_id, order_id, data, current_user.id)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.cancel_order(current_user.clinic_id, order_id)


# ══════════════════════════════════════════════════════════════════════════════
# Suppliers
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/suppliers")
async def list_suppliers(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = PharmacyService(session)
    return await service.list_suppliers(current_user.clinic_id, search, skip, limit)


@router.post("/suppliers", status_code=201)
async def create_supplier(
    data: SupplierCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.create_supplier(current_user.clinic_id, data)


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: uuid.UUID,
    data: SupplierUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    return await service.update_supplier(current_user.clinic_id, supplier_id, data)


@router.delete("/suppliers/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = PharmacyService(session)
    await service.delete_supplier(current_user.clinic_id, supplier_id)
