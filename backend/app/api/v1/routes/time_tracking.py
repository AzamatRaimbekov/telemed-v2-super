from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.time_tracking import TimeEntry
from app.models.user import User

router = APIRouter(prefix="/time-tracking", tags=["Time Tracking / Таймтрекинг"])

STANDARD_HOURS = 8.0


# ---------- schemas ----------

class ClockInRequest(BaseModel):
    department: str | None = None
    notes: str | None = None


class ClockOutRequest(BaseModel):
    break_minutes: float = 0
    notes: str | None = None


# ---------- helpers ----------

def _entry_to_dict(e: TimeEntry, user_name: str | None = None) -> dict:
    return {
        "id": str(e.id),
        "user_id": str(e.user_id),
        "user_name": user_name,
        "clock_in": e.clock_in.isoformat(),
        "clock_out": e.clock_out.isoformat() if e.clock_out else None,
        "hours_worked": e.hours_worked,
        "break_minutes": e.break_minutes,
        "overtime_hours": e.overtime_hours,
        "notes": e.notes,
        "department": e.department,
        "created_at": e.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/clock-in", status_code=201)
async def clock_in(
    data: ClockInRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Punch in — start a time entry."""
    # Check if already clocked in
    result = await session.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.clinic_id == current_user.clinic_id,
            TimeEntry.clock_out == None,
            TimeEntry.is_deleted == False,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"error": "Already clocked in", "entry": _entry_to_dict(existing)}

    entry = TimeEntry(
        clinic_id=current_user.clinic_id,
        user_id=current_user.id,
        clock_in=datetime.now(timezone.utc),
        department=data.department,
        notes=data.notes,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.post("/clock-out")
async def clock_out(
    data: ClockOutRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Punch out — end current time entry, calculate hours."""
    result = await session.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.clinic_id == current_user.clinic_id,
            TimeEntry.clock_out == None,
            TimeEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return {"error": "Not clocked in"}

    now = datetime.now(timezone.utc)
    entry.clock_out = now
    entry.break_minutes = data.break_minutes

    total_seconds = (now - entry.clock_in).total_seconds()
    net_hours = round((total_seconds / 3600) - (data.break_minutes / 60), 2)
    entry.hours_worked = max(0, net_hours)
    entry.overtime_hours = max(0, round(net_hours - STANDARD_HOURS, 2))

    if data.notes:
        entry.notes = (entry.notes or "") + (" | " if entry.notes else "") + data.notes

    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.get("/my")
async def my_entries(
    session: DBSession,
    current_user: CurrentUser,
    from_date: date | None = None,
    to_date: date | None = None,
):
    """My time entries (optional date range)."""
    q = select(TimeEntry).where(
        TimeEntry.user_id == current_user.id,
        TimeEntry.clinic_id == current_user.clinic_id,
        TimeEntry.is_deleted == False,
    )
    if from_date:
        q = q.where(func.date(TimeEntry.clock_in) >= from_date)
    if to_date:
        q = q.where(func.date(TimeEntry.clock_in) <= to_date)
    q = q.order_by(TimeEntry.clock_in.desc())
    result = await session.execute(q)
    return [_entry_to_dict(e) for e in result.scalars().all()]


@router.get("/status")
async def clock_status(
    session: DBSession,
    current_user: CurrentUser,
):
    """Am I currently clocked in?"""
    result = await session.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.clinic_id == current_user.clinic_id,
            TimeEntry.clock_out == None,
            TimeEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        elapsed = (datetime.now(timezone.utc) - entry.clock_in).total_seconds() / 3600
        return {
            "clocked_in": True,
            "since": entry.clock_in.isoformat(),
            "elapsed_hours": round(elapsed, 2),
            "entry": _entry_to_dict(entry),
        }
    return {"clocked_in": False}


@router.get("/report")
async def time_report(
    session: DBSession,
    current_user: CurrentUser,
    user_id: uuid.UUID | None = None,
    department: str | None = None,
    days: int = Query(30, description="Period in days"),
):
    """Report by user/department (admin)."""
    since = date.today() - timedelta(days=days)
    q = select(
        TimeEntry.user_id,
        User.full_name,
        TimeEntry.department,
        func.count().label("entries"),
        func.sum(TimeEntry.hours_worked).label("total_hours"),
        func.sum(TimeEntry.overtime_hours).label("total_overtime"),
    ).join(User, User.id == TimeEntry.user_id).where(
        TimeEntry.clinic_id == current_user.clinic_id,
        TimeEntry.is_deleted == False,
        func.date(TimeEntry.clock_in) >= since,
        TimeEntry.clock_out != None,
    )
    if user_id:
        q = q.where(TimeEntry.user_id == user_id)
    if department:
        q = q.where(TimeEntry.department == department)
    q = q.group_by(TimeEntry.user_id, User.full_name, TimeEntry.department)
    result = await session.execute(q)
    return [
        {
            "user_id": str(row.user_id),
            "user_name": row.full_name,
            "department": row.department,
            "entries": row.entries,
            "total_hours": round(row.total_hours or 0, 2),
            "total_overtime": round(row.total_overtime or 0, 2),
        }
        for row in result.all()
    ]


@router.get("/overtime")
async def overtime_alerts(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(7, description="Period in days"),
    threshold: float = Query(2.0, description="Overtime hours threshold"),
):
    """Users with overtime above threshold in the last N days."""
    since = date.today() - timedelta(days=days)
    result = await session.execute(
        select(
            TimeEntry.user_id,
            User.full_name,
            func.sum(TimeEntry.overtime_hours).label("total_overtime"),
            func.count().label("entries"),
        ).join(User, User.id == TimeEntry.user_id).where(
            TimeEntry.clinic_id == current_user.clinic_id,
            TimeEntry.is_deleted == False,
            func.date(TimeEntry.clock_in) >= since,
            TimeEntry.clock_out != None,
            TimeEntry.overtime_hours > 0,
        ).group_by(TimeEntry.user_id, User.full_name)
        .having(func.sum(TimeEntry.overtime_hours) >= threshold)
        .order_by(func.sum(TimeEntry.overtime_hours).desc())
    )
    return [
        {
            "user_id": str(row.user_id),
            "user_name": row.full_name,
            "total_overtime": round(row.total_overtime, 2),
            "entries": row.entries,
            "period_days": days,
        }
        for row in result.all()
    ]
