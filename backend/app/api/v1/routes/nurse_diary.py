from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.nurse_diary import NurseDiaryEntry
from app.models.user import User

router = APIRouter(prefix="/nurse-diary", tags=["Nurse Diary"])


# ---------- schemas ----------

class DiaryEntryCreate(BaseModel):
    patient_id: uuid.UUID
    entry_date: date
    shift: str = "day"
    general_condition: str | None = None
    consciousness: str | None = None
    temperature: str | None = None
    blood_pressure: str | None = None
    pulse: str | None = None
    respiratory_rate: str | None = None
    complaints: str | None = None
    procedures_done: str | None = None
    medications_given: dict | None = None
    diet: str | None = None
    notes: str | None = None


class DiaryEntryUpdate(BaseModel):
    general_condition: str | None = None
    consciousness: str | None = None
    temperature: str | None = None
    blood_pressure: str | None = None
    pulse: str | None = None
    respiratory_rate: str | None = None
    complaints: str | None = None
    procedures_done: str | None = None
    medications_given: dict | None = None
    diet: str | None = None
    notes: str | None = None


# ---------- helpers ----------

def _entry_to_dict(entry: NurseDiaryEntry, nurse_name: str | None = None) -> dict:
    return {
        "id": str(entry.id),
        "patient_id": str(entry.patient_id),
        "nurse_id": str(entry.nurse_id),
        "nurse_name": nurse_name,
        "entry_date": entry.entry_date.isoformat(),
        "shift": entry.shift,
        "general_condition": entry.general_condition,
        "consciousness": entry.consciousness,
        "temperature": entry.temperature,
        "blood_pressure": entry.blood_pressure,
        "pulse": entry.pulse,
        "respiratory_rate": entry.respiratory_rate,
        "complaints": entry.complaints,
        "procedures_done": entry.procedures_done,
        "medications_given": entry.medications_given,
        "diet": entry.diet,
        "notes": entry.notes,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


async def _enrich_entries(session: AsyncSession, entries: list[NurseDiaryEntry]) -> list[dict]:
    nurse_ids = {e.nurse_id for e in entries}
    names: dict[uuid.UUID, str] = {}
    if nurse_ids:
        result = await session.execute(
            select(User.id, User.first_name, User.last_name).where(User.id.in_(nurse_ids))
        )
        for uid, fn, ln in result.all():
            names[uid] = f"{fn} {ln}"
    return [_entry_to_dict(e, names.get(e.nurse_id)) for e in entries]


# ---------- endpoints ----------

@router.post("/", status_code=201)
async def create_entry(
    data: DiaryEntryCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a nurse diary entry."""
    entry = NurseDiaryEntry(
        patient_id=data.patient_id,
        nurse_id=current_user.id,
        entry_date=data.entry_date,
        shift=data.shift,
        general_condition=data.general_condition,
        consciousness=data.consciousness,
        temperature=data.temperature,
        blood_pressure=data.blood_pressure,
        pulse=data.pulse,
        respiratory_rate=data.respiratory_rate,
        complaints=data.complaints,
        procedures_done=data.procedures_done,
        medications_given=data.medications_given,
        diet=data.diet,
        notes=data.notes,
        clinic_id=current_user.clinic_id,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)


@router.get("/patient/{patient_id}")
async def get_patient_entries(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Get diary entries for a patient, optionally filtered by date range."""
    q = select(NurseDiaryEntry).where(
        NurseDiaryEntry.clinic_id == current_user.clinic_id,
        NurseDiaryEntry.patient_id == patient_id,
        NurseDiaryEntry.is_deleted == False,
    ).order_by(NurseDiaryEntry.entry_date.desc(), NurseDiaryEntry.created_at.desc()).limit(limit)

    if date_from:
        q = q.where(NurseDiaryEntry.entry_date >= date_from)
    if date_to:
        q = q.where(NurseDiaryEntry.entry_date <= date_to)

    result = await session.execute(q)
    entries = list(result.scalars().all())
    return await _enrich_entries(session, entries)


@router.get("/my-shift")
async def my_shift_entries(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get current nurse's entries for today."""
    today = date.today()
    q = select(NurseDiaryEntry).where(
        NurseDiaryEntry.clinic_id == current_user.clinic_id,
        NurseDiaryEntry.nurse_id == current_user.id,
        NurseDiaryEntry.entry_date == today,
        NurseDiaryEntry.is_deleted == False,
    ).order_by(NurseDiaryEntry.created_at.desc())

    result = await session.execute(q)
    entries = list(result.scalars().all())
    return await _enrich_entries(session, entries)


@router.get("/patient/{patient_id}/latest")
async def get_latest_entry(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get the latest diary entry for a patient."""
    q = select(NurseDiaryEntry).where(
        NurseDiaryEntry.clinic_id == current_user.clinic_id,
        NurseDiaryEntry.patient_id == patient_id,
        NurseDiaryEntry.is_deleted == False,
    ).order_by(NurseDiaryEntry.entry_date.desc(), NurseDiaryEntry.created_at.desc()).limit(1)

    result = await session.execute(q)
    entry = result.scalar_one_or_none()
    if not entry:
        return None
    return _entry_to_dict(entry)


@router.get("/{entry_id}")
async def get_entry(
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get a single diary entry by ID."""
    result = await session.execute(
        select(NurseDiaryEntry).where(
            NurseDiaryEntry.id == entry_id,
            NurseDiaryEntry.clinic_id == current_user.clinic_id,
            NurseDiaryEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("NurseDiaryEntry")
    return _entry_to_dict(entry)


@router.patch("/{entry_id}")
async def update_entry(
    entry_id: uuid.UUID,
    data: DiaryEntryUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a diary entry."""
    result = await session.execute(
        select(NurseDiaryEntry).where(
            NurseDiaryEntry.id == entry_id,
            NurseDiaryEntry.clinic_id == current_user.clinic_id,
            NurseDiaryEntry.is_deleted == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("NurseDiaryEntry")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(entry, key, val)

    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)
