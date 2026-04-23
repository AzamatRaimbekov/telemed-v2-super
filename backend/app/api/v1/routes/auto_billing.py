from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.auto_billing import AutoBillingService

router = APIRouter(prefix="/auto-billing", tags=["Auto-Billing"])


# ---------- schemas ----------


class ServiceItem(BaseModel):
    name: str
    price: float
    quantity: int = 1


class GenerateInvoiceRequest(BaseModel):
    patient_id: uuid.UUID
    visit_id: uuid.UUID | None = None
    services: list[ServiceItem] | None = None


class ServiceTemplateCreate(BaseModel):
    name: str
    price: float
    category: str = "CONSULTATION"


# ---------- helpers ----------


def _invoice_to_dict(inv) -> dict:
    return {
        "id": str(inv.id),
        "patient_id": str(inv.patient_id),
        "visit_id": str(inv.visit_id) if inv.visit_id else None,
        "invoice_number": inv.invoice_number,
        "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
        "subtotal": float(inv.subtotal) if inv.subtotal else 0,
        "total": float(inv.total) if inv.total else 0,
        "created_at": inv.created_at.isoformat(),
        "items": [
            {
                "id": str(it.id),
                "description": it.description,
                "quantity": float(it.quantity),
                "unit_price": float(it.unit_price),
                "total_price": float(it.total_price),
            }
            for it in (inv.items or [])
        ],
    }


# ---------- endpoints ----------


@router.post("/generate")
async def generate_invoice(
    body: GenerateInvoiceRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Auto-generate an invoice after a patient visit."""
    svc = AutoBillingService(session)
    services_dicts = (
        [s.model_dump() for s in body.services] if body.services else None
    )
    invoice = await svc.generate_invoice_for_visit(
        patient_id=body.patient_id,
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
        visit_id=body.visit_id,
        services=services_dicts,
    )
    return _invoice_to_dict(invoice)


@router.get("/templates")
async def get_service_templates(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get service price templates for the clinic."""
    svc = AutoBillingService(session)
    return await svc.get_service_templates(current_user.clinic_id)


@router.post("/templates")
async def create_service_template(
    body: ServiceTemplateCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create or update a service price template (placeholder — returns the submitted data)."""
    return {
        "name": body.name,
        "price": body.price,
        "category": body.category,
        "clinic_id": str(current_user.clinic_id),
        "message": "Шаблон сохранён",
    }
