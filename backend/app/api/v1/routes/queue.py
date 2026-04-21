from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.services.queue_service import QueueService

router = APIRouter(prefix="/queue", tags=["Queue"])


def _entry_to_dict(e) -> dict:
    patient_name = ""
    if e.patient:
        patient_name = f"{e.patient.last_name} {e.patient.first_name}"
    doctor_name = ""
    if e.doctor:
        doctor_name = f"{e.doctor.last_name} {e.doctor.first_name}"
    return {
        "id": e.id,
        "queue_number": e.queue_number,
        "patient_id": e.patient_id,
        "patient_name": patient_name,
        "doctor_id": e.doctor_id,
        "doctor_name": doctor_name,
        "appointment_id": e.appointment_id,
        "status": e.status.value if hasattr(e.status, "value") else str(e.status),
        "room_name": e.room_name,
        "display_name": e.display_name,
        "called_at": e.called_at,
        "completed_at": e.completed_at,
        "created_at": e.created_at,
    }


@router.post("/add")
async def add_to_queue(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID = Query(...),
    doctor_id: uuid.UUID | None = None,
    appointment_id: uuid.UUID | None = None,
    room_name: str | None = None,
    display_name: str | None = None,
):
    """Add a patient to today's queue (receptionist)."""
    svc = QueueService(session)
    entry = await svc.add_to_queue(
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_id=appointment_id,
        room_name=room_name,
        display_name=display_name,
    )
    return _entry_to_dict(entry)


@router.post("/call-next")
async def call_next(
    session: DBSession,
    current_user: CurrentUser,
    doctor_id: uuid.UUID | None = None,
):
    """Call the next waiting patient."""
    svc = QueueService(session)
    entry = await svc.call_next(
        clinic_id=current_user.clinic_id,
        doctor_id=doctor_id,
    )
    if not entry:
        return {"detail": "No waiting patients in the queue"}
    return _entry_to_dict(entry)


@router.post("/{entry_id}/start")
async def start_service(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark a queue entry as in progress."""
    svc = QueueService(session)
    entry = await svc.start_service(entry_id)
    if not entry:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("QueueEntry", str(entry_id))
    return _entry_to_dict(entry)


@router.post("/{entry_id}/complete")
async def complete_service(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark a queue entry as completed."""
    svc = QueueService(session)
    entry = await svc.complete_service(entry_id)
    if not entry:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("QueueEntry", str(entry_id))
    return _entry_to_dict(entry)


@router.post("/{entry_id}/skip")
async def skip_patient(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Skip a patient in the queue."""
    svc = QueueService(session)
    entry = await svc.skip_patient(entry_id)
    if not entry:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("QueueEntry", str(entry_id))
    return _entry_to_dict(entry)


@router.get("/today")
async def get_today_queue(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get today's active queue for the clinic."""
    svc = QueueService(session)
    entries = await svc.get_today_queue(current_user.clinic_id)
    return [_entry_to_dict(e) for e in entries]


@router.get("/lobby/{clinic_id}")
async def get_lobby_display(
    clinic_id: uuid.UUID,
    session: DBSession,
):
    """Public endpoint for lobby TV display - no auth required."""
    svc = QueueService(session)
    return await svc.get_lobby_display(clinic_id)
