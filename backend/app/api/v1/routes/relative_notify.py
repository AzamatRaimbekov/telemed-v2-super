from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.relative_notifier import RelativeNotifierService

router = APIRouter(prefix="/relative-notify", tags=["Relative Notifications"])


# ---------- schemas ----------


class NotifyRequest(BaseModel):
    patient_id: uuid.UUID


# ---------- endpoints ----------


@router.post("/admission")
async def notify_admission(
    body: NotifyRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Notify patient's relatives/guardians about hospital admission."""
    svc = RelativeNotifierService(session)
    result = await svc.notify_admission(
        patient_id=body.patient_id,
        clinic_id=current_user.clinic_id,
    )
    return result


@router.post("/discharge")
async def notify_discharge(
    body: NotifyRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Notify patient's relatives/guardians about discharge."""
    svc = RelativeNotifierService(session)
    result = await svc.notify_discharge(
        patient_id=body.patient_id,
        clinic_id=current_user.clinic_id,
    )
    return result
