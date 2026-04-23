from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.whatsapp_booking_service import WhatsAppBookingService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp-booking"])


class WhatsAppWebhookPayload(BaseModel):
    phone: str
    message: str
    clinic_id: str | None = None


class WhatsAppWebhookResponse(BaseModel):
    reply: str


@router.post("/webhook", response_model=WhatsAppWebhookResponse)
async def whatsapp_webhook(
    data: WhatsAppWebhookPayload,
    session: DBSession,
):
    """
    Receive incoming WhatsApp message and return a reply.
    This endpoint is called by the WhatsApp Business API webhook.
    """
    import uuid

    # Use provided clinic_id or fallback to a default
    clinic_id = uuid.UUID(data.clinic_id) if data.clinic_id else None
    if not clinic_id:
        # Try to find clinic from the first available one (single-tenant fallback)
        from sqlalchemy import select
        from app.models.clinic import Clinic
        result = await session.execute(select(Clinic).limit(1))
        clinic = result.scalar_one_or_none()
        clinic_id = clinic.id if clinic else uuid.uuid4()

    service = WhatsAppBookingService(session)
    reply = await service.parse_message(
        phone=data.phone,
        message=data.message,
        clinic_id=clinic_id,
    )
    return WhatsAppWebhookResponse(reply=reply)


@router.get("/booking-status/{phone}")
async def get_booking_status(
    phone: str,
    session: DBSession,
    current_user: CurrentUser,
):
    """Check booking status by phone number (requires auth)."""
    service = WhatsAppBookingService(session)
    return await service.get_booking_status(
        phone=phone,
        clinic_id=current_user.clinic_id,
    )
