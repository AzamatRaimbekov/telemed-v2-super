from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel
from uuid import UUID


# ── Inventory ──────────────────────────────────────────────────────────────────


class InventoryDrugOut(BaseModel):
    drug_id: UUID
    drug_name: str
    generic_name: str | None = None
    form: str
    category: str | None = None
    total_quantity: int
    low_stock_threshold: int
    nearest_expiry: date | None = None
    status: str  # ok, low, out, expired


class BatchOut(BaseModel):
    id: UUID
    batch_number: str | None = None
    quantity: int
    purchase_price: float | None = None
    supplier_name: str | None = None
    expiry_date: date | None = None
    created_at: datetime


class WriteOffRequest(BaseModel):
    inventory_id: UUID
    quantity: int
    reason: str  # EXPIRED, DAMAGED, LOST, OTHER


class AdjustRequest(BaseModel):
    inventory_id: UUID
    quantity: int  # new absolute quantity
    reason: str


# ── Dispensing ─────────────────────────────────────────────────────────────────


class PrescriptionQueueItem(BaseModel):
    id: UUID
    patient_name: str
    doctor_name: str
    prescribed_at: datetime | None = None
    items_count: int
    status: str


class DispenseItemRequest(BaseModel):
    prescription_item_id: UUID
    quantity: int
    inventory_id: UUID | None = None  # if None, auto FIFO


class DispenseRequest(BaseModel):
    items: list[DispenseItemRequest]


# ── Purchase Orders ────────────────────────────────────────────────────────────


class PurchaseOrderItemCreate(BaseModel):
    drug_id: UUID
    quantity_ordered: int
    unit_price: float | None = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    items: list[PurchaseOrderItemCreate]
    notes: str | None = None


class PurchaseOrderUpdate(BaseModel):
    supplier_id: UUID | None = None
    items: list[PurchaseOrderItemCreate] | None = None
    notes: str | None = None


class ReceiveItemRequest(BaseModel):
    purchase_order_item_id: UUID
    quantity_received: int
    batch_number: str | None = None
    expiry_date: date | None = None


class ReceiveOrderRequest(BaseModel):
    items: list[ReceiveItemRequest]


# ── Suppliers ──────────────────────────────────────────────────────────────────


class SupplierCreate(BaseModel):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None


# ── Dashboard ──────────────────────────────────────────────────────────────────


class PharmacyAlert(BaseModel):
    severity: str  # red, yellow, blue
    message: str
    reference_type: str | None = None
    reference_id: UUID | None = None
