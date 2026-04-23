from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.auto_assignment import AutoAssignmentService

router = APIRouter(prefix="/auto-assign", tags=["Auto Assignment"])


# ---------- schemas ----------

class AutoAssignRequest(BaseModel):
    patient_id: uuid.UUID
    department_id: uuid.UUID | None = None
    gender: str | None = None


class SuggestRequest(BaseModel):
    department_id: uuid.UUID | None = None
    gender: str | None = None


# ---------- endpoints ----------

@router.post("/bed")
async def auto_assign_bed(
    data: AutoAssignRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Automatically assign patient to the best available bed."""
    service = AutoAssignmentService(session)
    result = await service.auto_assign_patient(
        patient_id=data.patient_id,
        clinic_id=current_user.clinic_id,
        gender=data.gender,
        department_id=data.department_id,
    )
    return result


@router.post("/suggest")
async def suggest_bed(
    data: SuggestRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Suggest the best available bed without assigning."""
    service = AutoAssignmentService(session)
    suggestion = await service.find_best_bed(
        clinic_id=current_user.clinic_id,
        gender=data.gender,
        department_id=data.department_id,
    )
    if not suggestion:
        return {"error": "Нет свободных коек", "auto_assigned": False}
    return suggestion
