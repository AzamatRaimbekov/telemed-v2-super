from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from sqlalchemy import select
from app.api.deps import CurrentUser, DBSession
from app.models.appointment import Appointment

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/my")
async def my_schedule(
    session: DBSession,
    current_user: CurrentUser,
    date: str | None = None,
    days: int = Query(7, ge=1, le=31),
):
    """Get current user's appointments for a date range."""
    if date:
        start_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    else:
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=days)

    query = (
        select(Appointment)
        .where(
            Appointment.doctor_id == current_user.id,
            Appointment.clinic_id == current_user.clinic_id,
            Appointment.is_deleted == False,
            Appointment.scheduled_start >= start_date,
            Appointment.scheduled_start < end_date,
        )
        .order_by(Appointment.scheduled_start)
    )
    result = await session.execute(query)
    appointments = list(result.scalars().all())

    return [_schedule_to_dict(a) for a in appointments]


@router.get("/all")
async def all_schedule(
    session: DBSession,
    current_user: CurrentUser,
    date: str | None = None,
    days: int = Query(7, ge=1, le=31),
    doctor_id: uuid.UUID | None = None,
):
    """Get all appointments for the clinic (admin view)."""
    if date:
        start_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    else:
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=days)

    query = (
        select(Appointment)
        .where(
            Appointment.clinic_id == current_user.clinic_id,
            Appointment.is_deleted == False,
            Appointment.scheduled_start >= start_date,
            Appointment.scheduled_start < end_date,
        )
        .order_by(Appointment.scheduled_start)
    )
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    result = await session.execute(query)
    return [_schedule_to_dict(a) for a in result.scalars().all()]


@router.post("")
async def create_appointment(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID = Query(...),
    doctor_id: uuid.UUID | None = None,
    appointment_type: str = Query("CONSULTATION"),
    scheduled_start: str = Query(...),
    scheduled_end: str | None = None,
    reason: str | None = None,
    notes: str | None = None,
):
    from app.models.appointment import AppointmentType, AppointmentStatus
    start = datetime.fromisoformat(scheduled_start)
    end = datetime.fromisoformat(scheduled_end) if scheduled_end else start + timedelta(minutes=30)

    appt = Appointment(
        id=uuid.uuid4(),
        patient_id=patient_id,
        doctor_id=doctor_id or current_user.id,
        clinic_id=current_user.clinic_id,
        appointment_type=AppointmentType(appointment_type),
        status=AppointmentStatus.SCHEDULED,
        scheduled_start=start,
        scheduled_end=end,
        reason=reason,
        notes=notes,
    )
    session.add(appt)
    await session.flush()
    await session.refresh(appt)
    await session.commit()
    return _schedule_to_dict(appt)


@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = None,
    notes: str | None = None,
    scheduled_start: str | None = None,
    scheduled_end: str | None = None,
):
    from app.models.appointment import AppointmentStatus
    query = select(Appointment).where(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current_user.clinic_id,
        Appointment.is_deleted == False,
    )
    result = await session.execute(query)
    appt = result.scalar_one_or_none()
    if not appt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Appointment", str(appointment_id))

    now = datetime.now(timezone.utc)
    if status:
        appt.status = AppointmentStatus(status)
        if status == "IN_PROGRESS" and not appt.actual_start:
            appt.actual_start = now
        elif status in ("COMPLETED", "NO_SHOW") and not appt.actual_end:
            appt.actual_end = now
    if notes is not None:
        appt.notes = notes
    if scheduled_start:
        appt.scheduled_start = datetime.fromisoformat(scheduled_start)
    if scheduled_end:
        appt.scheduled_end = datetime.fromisoformat(scheduled_end)

    await session.flush()
    await session.refresh(appt)
    await session.commit()
    return _schedule_to_dict(appt)


@router.delete("/{appointment_id}", status_code=204)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    from app.models.appointment import AppointmentStatus
    query = select(Appointment).where(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current_user.clinic_id,
        Appointment.is_deleted == False,
    )
    result = await session.execute(query)
    appt = result.scalar_one_or_none()
    if not appt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Appointment", str(appointment_id))
    appt.status = AppointmentStatus.CANCELLED
    await session.flush()
    await session.commit()


def _schedule_to_dict(a) -> dict:
    patient_name = ""
    if a.patient:
        patient_name = f"{a.patient.last_name} {a.patient.first_name}"
    doctor_name = ""
    if a.doctor:
        doctor_name = f"{a.doctor.last_name} {a.doctor.first_name}"
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": patient_name,
        "doctor_id": a.doctor_id,
        "doctor_name": doctor_name,
        "appointment_type": a.appointment_type.value if hasattr(a.appointment_type, "value") else str(a.appointment_type),
        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        "scheduled_start": a.scheduled_start,
        "scheduled_end": a.scheduled_end,
        "actual_start": a.actual_start,
        "actual_end": a.actual_end,
        "reason": a.reason,
        "notes": a.notes,
        "is_walk_in": a.is_walk_in,
        "queue_number": a.queue_number,
        "created_at": a.created_at,
    }
