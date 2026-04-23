from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.infection_control import InfectionRecord, IsolationType, InfectionStatus
from app.models.user import User

router = APIRouter(prefix="/infection-control", tags=["Infection Control"])


# ---------- schemas ----------

class InfectionCreate(BaseModel):
    patient_id: uuid.UUID
    infection_type: str
    isolation_type: IsolationType = IsolationType.CONTACT
    status: InfectionStatus = InfectionStatus.SUSPECTED
    detected_date: date
    room_id: uuid.UUID | None = None
    is_quarantined: bool = False
    precautions: str | None = None
    contact_trace: str | None = None
    notes: str | None = None


class InfectionUpdate(BaseModel):
    infection_type: str | None = None
    isolation_type: IsolationType | None = None
    status: InfectionStatus | None = None
    resolved_date: date | None = None
    room_id: uuid.UUID | None = None
    is_quarantined: bool | None = None
    precautions: str | None = None
    contact_trace: str | None = None
    notes: str | None = None


# ---------- helpers ----------

def _record_to_dict(record: InfectionRecord, reporter_name: str | None = None) -> dict:
    return {
        "id": str(record.id),
        "patient_id": str(record.patient_id),
        "reported_by_id": str(record.reported_by_id),
        "reporter_name": reporter_name,
        "infection_type": record.infection_type,
        "isolation_type": record.isolation_type.value if isinstance(record.isolation_type, IsolationType) else record.isolation_type,
        "status": record.status.value if isinstance(record.status, InfectionStatus) else record.status,
        "detected_date": record.detected_date.isoformat(),
        "resolved_date": record.resolved_date.isoformat() if record.resolved_date else None,
        "room_id": str(record.room_id) if record.room_id else None,
        "is_quarantined": record.is_quarantined,
        "precautions": record.precautions,
        "contact_trace": record.contact_trace,
        "notes": record.notes,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
    }


async def _enrich_records(session: AsyncSession, records: list[InfectionRecord]) -> list[dict]:
    reporter_ids = {r.reported_by_id for r in records}
    names: dict[uuid.UUID, str] = {}
    if reporter_ids:
        result = await session.execute(
            select(User.id, User.first_name, User.last_name).where(User.id.in_(reporter_ids))
        )
        for uid, fn, ln in result.all():
            names[uid] = f"{fn} {ln}"
    return [_record_to_dict(r, names.get(r.reported_by_id)) for r in records]


# ---------- endpoints ----------

@router.post("/", status_code=201)
async def report_infection(
    data: InfectionCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Report a new infection case."""
    record = InfectionRecord(
        patient_id=data.patient_id,
        reported_by_id=current_user.id,
        infection_type=data.infection_type,
        isolation_type=data.isolation_type,
        status=data.status,
        detected_date=data.detected_date,
        room_id=data.room_id,
        is_quarantined=data.is_quarantined,
        precautions=data.precautions,
        contact_trace=data.contact_trace,
        notes=data.notes,
        clinic_id=current_user.clinic_id,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return _record_to_dict(record)


@router.get("/active-count")
async def active_infection_count(
    session: DBSession,
    current_user: CurrentUser,
):
    """Count active infections grouped by type."""
    q = select(
        InfectionRecord.infection_type,
        func.count(InfectionRecord.id).label("count"),
    ).where(
        InfectionRecord.clinic_id == current_user.clinic_id,
        InfectionRecord.status.in_([InfectionStatus.SUSPECTED, InfectionStatus.CONFIRMED, InfectionStatus.MONITORING]),
        InfectionRecord.is_deleted == False,
    ).group_by(InfectionRecord.infection_type)

    result = await session.execute(q)
    rows = result.all()
    return {row[0]: row[1] for row in rows}


@router.get("/quarantine-rooms")
async def quarantine_rooms(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get rooms currently under quarantine."""
    q = select(InfectionRecord).where(
        InfectionRecord.clinic_id == current_user.clinic_id,
        InfectionRecord.is_quarantined == True,
        InfectionRecord.status.in_([InfectionStatus.SUSPECTED, InfectionStatus.CONFIRMED, InfectionStatus.MONITORING]),
        InfectionRecord.is_deleted == False,
        InfectionRecord.room_id.isnot(None),
    )

    result = await session.execute(q)
    records = list(result.scalars().all())
    # Return unique room IDs with infection details
    rooms: dict[str, list] = {}
    for r in records:
        room_key = str(r.room_id)
        if room_key not in rooms:
            rooms[room_key] = []
        rooms[room_key].append({
            "infection_type": r.infection_type,
            "isolation_type": r.isolation_type.value if isinstance(r.isolation_type, IsolationType) else r.isolation_type,
            "patient_id": str(r.patient_id),
        })
    return rooms


@router.get("/")
async def list_infections(
    session: DBSession,
    current_user: CurrentUser,
    status: InfectionStatus | None = Query(None),
    isolation_type: IsolationType | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """List active infection records with optional filters."""
    q = select(InfectionRecord).where(
        InfectionRecord.clinic_id == current_user.clinic_id,
        InfectionRecord.is_deleted == False,
    ).order_by(InfectionRecord.detected_date.desc()).limit(limit)

    if status:
        q = q.where(InfectionRecord.status == status)
    if isolation_type:
        q = q.where(InfectionRecord.isolation_type == isolation_type)

    result = await session.execute(q)
    records = list(result.scalars().all())
    return await _enrich_records(session, records)


@router.get("/{record_id}")
async def get_infection(
    record_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get a single infection record."""
    result = await session.execute(
        select(InfectionRecord).where(
            InfectionRecord.id == record_id,
            InfectionRecord.clinic_id == current_user.clinic_id,
            InfectionRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("InfectionRecord")
    return _record_to_dict(record)


@router.patch("/{record_id}")
async def update_infection(
    record_id: uuid.UUID,
    data: InfectionUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update an infection record."""
    result = await session.execute(
        select(InfectionRecord).where(
            InfectionRecord.id == record_id,
            InfectionRecord.clinic_id == current_user.clinic_id,
            InfectionRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("InfectionRecord")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(record, key, val)

    await session.commit()
    await session.refresh(record)
    return _record_to_dict(record)


@router.patch("/{record_id}/resolve")
async def resolve_infection(
    record_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark an infection as resolved."""
    result = await session.execute(
        select(InfectionRecord).where(
            InfectionRecord.id == record_id,
            InfectionRecord.clinic_id == current_user.clinic_id,
            InfectionRecord.is_deleted == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("InfectionRecord")

    record.status = InfectionStatus.RESOLVED
    record.resolved_date = date.today()
    record.is_quarantined = False

    await session.commit()
    await session.refresh(record)
    return _record_to_dict(record)
