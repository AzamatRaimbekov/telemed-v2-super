from fastapi import APIRouter, Query, HTTPException
from datetime import date, datetime, timezone
from sqlalchemy import select, and_, cast, Date
from app.api.deps import CurrentUser, DBSession
from app.models.appointment import Appointment
from app.models.user import User, UserRole
import uuid

router = APIRouter(prefix="/schedule/calendar", tags=["Schedule Calendar"])


@router.get("/events")
async def get_calendar_events(
    session: DBSession,
    current_user: CurrentUser,
    doctor_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = select(Appointment).where(
        Appointment.clinic_id == current_user.clinic_id,
        Appointment.is_deleted == False,
    )
    if doctor_id:
        query = query.where(Appointment.doctor_id == uuid.UUID(doctor_id))
    if date_from:
        query = query.where(cast(Appointment.scheduled_start, Date) >= date_from)
    if date_to:
        query = query.where(cast(Appointment.scheduled_start, Date) <= date_to)

    result = await session.execute(query.order_by(Appointment.scheduled_start))
    appointments = result.scalars().all()

    events = []
    for apt in appointments:
        events.append({
            "id": str(apt.id),
            "title": "Приём",
            "start": apt.scheduled_start.isoformat() if apt.scheduled_start else None,
            "end": apt.scheduled_end.isoformat() if apt.scheduled_end else None,
            "doctor_id": str(apt.doctor_id) if apt.doctor_id else None,
            "patient_id": str(apt.patient_id) if apt.patient_id else None,
            "status": apt.status.value if hasattr(apt.status, "value") else str(apt.status),
            "type": apt.appointment_type.value if hasattr(apt.appointment_type, "value") else str(apt.appointment_type) if apt.appointment_type else None,
        })
    return events


@router.put("/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: str,
    session: DBSession,
    current_user: CurrentUser,
    new_date: str = Query(...),
    new_time: str = Query(...),
):
    result = await session.execute(
        select(Appointment).where(Appointment.id == uuid.UUID(appointment_id))
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(404, "Appointment not found")

    new_dt = datetime.fromisoformat(f"{new_date}T{new_time}")
    apt.scheduled_start = new_dt.replace(tzinfo=timezone.utc)
    await session.commit()
    return {"status": "rescheduled", "new_time": apt.scheduled_start.isoformat()}


@router.get("/doctors")
async def get_calendar_doctors(
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(User).where(
            User.clinic_id == current_user.clinic_id,
            User.role == UserRole.DOCTOR,
            User.is_active == True,
            User.is_deleted == False,
        )
    )
    doctors = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": f"{d.last_name} {d.first_name}",
            "specialization": getattr(d, "specialization", None),
        }
        for d in doctors
    ]
