from __future__ import annotations

import uuid
from datetime import date, time, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.duty_schedule import DutyScheduleEntry, DutyType

router = APIRouter(prefix="/duty-schedule", tags=["Duty Schedule"])


# ---------- schemas ----------

class CreateDutyRequest(BaseModel):
    doctor_id: uuid.UUID
    duty_date: date
    duty_type: DutyType
    start_time: time | None = None
    end_time: time | None = None
    department: str | None = None
    notes: str | None = None


class UpdateDutyRequest(BaseModel):
    doctor_id: uuid.UUID | None = None
    duty_date: date | None = None
    duty_type: DutyType | None = None
    start_time: time | None = None
    end_time: time | None = None
    department: str | None = None
    notes: str | None = None


# ---------- helpers ----------

def _duty_to_dict(d: DutyScheduleEntry) -> dict:
    return {
        "id": str(d.id),
        "doctor_id": str(d.doctor_id),
        "duty_date": d.duty_date.isoformat(),
        "duty_type": d.duty_type.value if hasattr(d.duty_type, "value") else str(d.duty_type),
        "start_time": d.start_time.isoformat() if d.start_time else None,
        "end_time": d.end_time.isoformat() if d.end_time else None,
        "department": d.department,
        "notes": d.notes,
        "created_by_id": str(d.created_by_id) if d.created_by_id else None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/")
async def create_duty(
    body: CreateDutyRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Assign a duty shift."""
    entry = DutyScheduleEntry(
        clinic_id=current_user.clinic_id,
        doctor_id=body.doctor_id,
        duty_date=body.duty_date,
        duty_type=body.duty_type,
        start_time=body.start_time,
        end_time=body.end_time,
        department=body.department,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _duty_to_dict(entry)


@router.get("/")
async def list_duties(
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
    doctor_id: uuid.UUID | None = None,
    duty_type: DutyType | None = None,
    department: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List duty schedule entries with filters."""
    q = (
        select(DutyScheduleEntry)
        .where(
            DutyScheduleEntry.clinic_id == current_user.clinic_id,
            DutyScheduleEntry.is_deleted == False,
        )
    )
    if date_from:
        q = q.where(DutyScheduleEntry.duty_date >= date_from)
    if date_to:
        q = q.where(DutyScheduleEntry.duty_date <= date_to)
    if doctor_id:
        q = q.where(DutyScheduleEntry.doctor_id == doctor_id)
    if duty_type:
        q = q.where(DutyScheduleEntry.duty_type == duty_type)
    if department:
        q = q.where(DutyScheduleEntry.department == department)

    q = q.order_by(DutyScheduleEntry.duty_date.asc()).limit(limit).offset(offset)
    result = await session.execute(q)
    return [_duty_to_dict(d) for d in result.scalars().all()]


@router.get("/today")
async def get_today_duties(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get who's on duty today."""
    today = date.today()
    result = await session.execute(
        select(DutyScheduleEntry)
        .where(
            DutyScheduleEntry.clinic_id == current_user.clinic_id,
            DutyScheduleEntry.duty_date == today,
            DutyScheduleEntry.is_deleted == False,
        )
        .order_by(DutyScheduleEntry.start_time.asc().nullslast())
    )
    return [_duty_to_dict(d) for d in result.scalars().all()]


@router.get("/tomorrow")
async def get_tomorrow_duties(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get who's on duty tomorrow."""
    tomorrow = date.today() + timedelta(days=1)
    result = await session.execute(
        select(DutyScheduleEntry)
        .where(
            DutyScheduleEntry.clinic_id == current_user.clinic_id,
            DutyScheduleEntry.duty_date == tomorrow,
            DutyScheduleEntry.is_deleted == False,
        )
        .order_by(DutyScheduleEntry.start_time.asc().nullslast())
    )
    return [_duty_to_dict(d) for d in result.scalars().all()]


@router.get("/week")
async def get_week_duties(
    session: DBSession,
    current_user: CurrentUser,
    start_date: date | None = None,
):
    """Get duty schedule for a week (defaults to current week starting Monday)."""
    if start_date is None:
        today = date.today()
        start_date = today - timedelta(days=today.weekday())  # Monday
    end_date = start_date + timedelta(days=6)

    result = await session.execute(
        select(DutyScheduleEntry)
        .where(
            DutyScheduleEntry.clinic_id == current_user.clinic_id,
            DutyScheduleEntry.duty_date >= start_date,
            DutyScheduleEntry.duty_date <= end_date,
            DutyScheduleEntry.is_deleted == False,
        )
        .order_by(DutyScheduleEntry.duty_date.asc(), DutyScheduleEntry.start_time.asc().nullslast())
    )
    entries = [_duty_to_dict(d) for d in result.scalars().all()]

    # Group by date
    week = {}
    for entry in entries:
        d = entry["duty_date"]
        if d not in week:
            week[d] = []
        week[d].append(entry)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "days": week,
        "total": len(entries),
    }


@router.get("/doctor/{doctor_id}")
async def get_doctor_duties(
    doctor_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """Get duty schedule for a specific doctor."""
    q = (
        select(DutyScheduleEntry)
        .where(
            DutyScheduleEntry.clinic_id == current_user.clinic_id,
            DutyScheduleEntry.doctor_id == doctor_id,
            DutyScheduleEntry.is_deleted == False,
        )
    )
    if date_from:
        q = q.where(DutyScheduleEntry.duty_date >= date_from)
    if date_to:
        q = q.where(DutyScheduleEntry.duty_date <= date_to)

    q = q.order_by(DutyScheduleEntry.duty_date.desc()).limit(limit).offset(offset)
    result = await session.execute(q)
    return [_duty_to_dict(d) for d in result.scalars().all()]


@router.patch("/{duty_id}")
async def update_duty(
    duty_id: uuid.UUID,
    body: UpdateDutyRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a duty schedule entry."""
    result = await session.execute(
        select(DutyScheduleEntry).where(
            DutyScheduleEntry.id == duty_id,
            DutyScheduleEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    await session.commit()
    await session.refresh(entry)
    return _duty_to_dict(entry)


@router.delete("/{duty_id}")
async def delete_duty(
    duty_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Remove a duty schedule entry (soft delete)."""
    result = await session.execute(
        select(DutyScheduleEntry).where(
            DutyScheduleEntry.id == duty_id,
            DutyScheduleEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Duty entry not found")

    entry.is_deleted = True
    await session.commit()
    return {"ok": True, "detail": "Duty entry deleted"}
