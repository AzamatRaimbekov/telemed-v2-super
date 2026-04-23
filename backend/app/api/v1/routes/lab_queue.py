from __future__ import annotations

import uuid
from datetime import datetime, date, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, cast, Date

from app.api.deps import CurrentUser, DBSession
from app.models.lab_queue import LabQueueEntry, LabQueueStatus

router = APIRouter(prefix="/lab-queue", tags=["Lab Queue"])


# ---------- schemas ----------

class AddToLabQueueRequest(BaseModel):
    patient_id: uuid.UUID
    lab_order_id: uuid.UUID | None = None
    display_name: str | None = None


# ---------- helpers ----------

def _entry_to_dict(e: LabQueueEntry) -> dict:
    return {
        "id": str(e.id),
        "queue_number": e.queue_number,
        "patient_id": str(e.patient_id),
        "lab_order_id": str(e.lab_order_id) if e.lab_order_id else None,
        "status": e.status.value if hasattr(e.status, "value") else str(e.status),
        "window_number": e.window_number,
        "display_name": e.display_name,
        "called_at": e.called_at.isoformat() if e.called_at else None,
        "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        "created_at": e.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/add")
async def add_to_lab_queue(
    body: AddToLabQueueRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Add a patient to the lab queue."""
    today = date.today()

    # Get next queue number for today
    result = await session.execute(
        select(func.coalesce(func.max(LabQueueEntry.queue_number), 0))
        .where(
            LabQueueEntry.clinic_id == current_user.clinic_id,
            cast(LabQueueEntry.created_at, Date) == today,
            LabQueueEntry.is_deleted == False,
        )
    )
    max_num = result.scalar() or 0

    entry = LabQueueEntry(
        clinic_id=current_user.clinic_id,
        queue_number=max_num + 1,
        patient_id=body.patient_id,
        lab_order_id=body.lab_order_id,
        status=LabQueueStatus.WAITING,
        display_name=body.display_name,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.post("/call-next")
async def call_next_lab(
    session: DBSession,
    current_user: CurrentUser,
    window: int = Query(1, description="Window number"),
):
    """Call the next waiting patient to a specific window."""
    today = date.today()

    result = await session.execute(
        select(LabQueueEntry)
        .where(
            LabQueueEntry.clinic_id == current_user.clinic_id,
            cast(LabQueueEntry.created_at, Date) == today,
            LabQueueEntry.status == LabQueueStatus.WAITING,
            LabQueueEntry.is_deleted == False,
        )
        .order_by(LabQueueEntry.queue_number.asc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return {"detail": "No waiting patients in the lab queue"}

    entry.status = LabQueueStatus.CALLED
    entry.window_number = window
    entry.called_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.post("/{entry_id}/complete")
async def complete_lab_entry(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark a lab queue entry as completed (sample collected)."""
    result = await session.execute(
        select(LabQueueEntry).where(LabQueueEntry.id == entry_id, LabQueueEntry.is_deleted == False)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Lab queue entry not found")

    entry.status = LabQueueStatus.COMPLETED
    entry.completed_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.post("/{entry_id}/skip")
async def skip_lab_entry(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Skip a patient in the lab queue."""
    result = await session.execute(
        select(LabQueueEntry).where(LabQueueEntry.id == entry_id, LabQueueEntry.is_deleted == False)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Lab queue entry not found")

    entry.status = LabQueueStatus.SKIPPED
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.get("/today")
async def get_today_lab_queue(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get today's lab queue for the clinic."""
    today = date.today()

    result = await session.execute(
        select(LabQueueEntry)
        .where(
            LabQueueEntry.clinic_id == current_user.clinic_id,
            cast(LabQueueEntry.created_at, Date) == today,
            LabQueueEntry.is_deleted == False,
        )
        .order_by(LabQueueEntry.queue_number.asc())
    )
    entries = result.scalars().all()
    return [_entry_to_dict(e) for e in entries]


@router.get("/display")
async def lab_queue_display(
    session: DBSession,
    clinic_id: uuid.UUID = Query(...),
):
    """Public display for lab lobby - no auth required."""
    today = date.today()

    result = await session.execute(
        select(LabQueueEntry)
        .where(
            LabQueueEntry.clinic_id == clinic_id,
            cast(LabQueueEntry.created_at, Date) == today,
            LabQueueEntry.is_deleted == False,
            LabQueueEntry.status.in_([LabQueueStatus.WAITING, LabQueueStatus.CALLED, LabQueueStatus.COLLECTING]),
        )
        .order_by(LabQueueEntry.queue_number.asc())
    )
    entries = result.scalars().all()

    waiting = []
    active = []
    for e in entries:
        item = {
            "queue_number": e.queue_number,
            "display_name": e.display_name,
            "window_number": e.window_number,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status),
        }
        if e.status == LabQueueStatus.WAITING:
            waiting.append(item)
        else:
            active.append(item)

    return {
        "active": active,
        "waiting": waiting,
        "total_waiting": len(waiting),
    }
