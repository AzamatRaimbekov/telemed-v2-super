from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.patient_changelog import PatientChangelog

router = APIRouter(prefix="/patients", tags=["Patient Changelog"])


# ---------- schemas ----------

class ChangelogCreate(BaseModel):
    action: str  # "create", "update", "delete"
    entity_type: str  # "patient", "visit", "prescription", "lab_result"
    entity_id: uuid.UUID | None = None
    changes: dict | None = None
    summary: str | None = None


def _entry_to_dict(entry: PatientChangelog) -> dict:
    return {
        "id": str(entry.id),
        "patient_id": str(entry.patient_id),
        "changed_by_id": str(entry.changed_by_id),
        "changed_by_name": entry.changed_by_name,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": str(entry.entity_id) if entry.entity_id else None,
        "changes": entry.changes,
        "summary": entry.summary,
        "created_at": entry.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.get("/{patient_id}/changelog")
async def get_changelog(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    entity_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Get change history for a patient."""
    q = select(PatientChangelog).where(
        PatientChangelog.patient_id == patient_id,
        PatientChangelog.clinic_id == current_user.clinic_id,
        PatientChangelog.is_deleted == False,
    ).order_by(PatientChangelog.created_at.desc()).limit(limit)

    if entity_type:
        q = q.where(PatientChangelog.entity_type == entity_type)

    result = await session.execute(q)
    entries = list(result.scalars().all())
    return [_entry_to_dict(e) for e in entries]


@router.post("/{patient_id}/changelog", status_code=201)
async def create_changelog_entry(
    patient_id: uuid.UUID,
    data: ChangelogCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Record a change to a patient record."""
    entry = PatientChangelog(
        patient_id=patient_id,
        changed_by_id=current_user.id,
        changed_by_name=f"{current_user.first_name} {current_user.last_name}",
        action=data.action,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        changes=data.changes,
        summary=data.summary,
        clinic_id=current_user.clinic_id,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _entry_to_dict(entry)
