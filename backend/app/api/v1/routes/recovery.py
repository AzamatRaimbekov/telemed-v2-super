from __future__ import annotations

import uuid
from fastapi import APIRouter

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.recovery import (
    RecoveryGoalsBulkUpdate,
    RecoveryWeightsBulkUpdate,
)
from app.services.recovery import RecoveryService

router = APIRouter(prefix="/patients", tags=["Recovery Dynamics"])


def _goal_to_dict(g) -> dict:
    set_by_name = None
    if g.set_by:
        set_by_name = f"{g.set_by.last_name} {g.set_by.first_name}"
    return {
        "id": g.id,
        "patient_id": g.patient_id,
        "domain": g.domain.value,
        "metric_key": g.metric_key,
        "target_value": float(g.target_value) if g.target_value is not None else None,
        "set_by_id": g.set_by_id,
        "set_by_name": set_by_name,
        "created_at": g.created_at,
        "updated_at": g.updated_at,
    }


def _weight_to_dict(w) -> dict:
    return {
        "id": w.id,
        "patient_id": w.patient_id,
        "domain": w.domain.value,
        "weight": float(w.weight),
        "set_by_id": w.set_by_id,
        "created_at": w.created_at,
        "updated_at": w.updated_at,
    }


@router.get("/{patient_id}/recovery-goals")
async def get_recovery_goals(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    svc = RecoveryService(session)
    goals = await svc.list_goals(patient_id, current_user.clinic_id)
    return [_goal_to_dict(g) for g in goals]


@router.put("/{patient_id}/recovery-goals")
async def update_recovery_goals(
    patient_id: uuid.UUID,
    body: RecoveryGoalsBulkUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    svc = RecoveryService(session)
    goals = await svc.bulk_upsert_goals(
        patient_id, current_user.clinic_id, current_user.id,
        [g.model_dump() for g in body.goals],
    )
    await session.commit()
    return [_goal_to_dict(g) for g in goals]


@router.get("/{patient_id}/recovery-weights")
async def get_recovery_weights(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    svc = RecoveryService(session)
    weights = await svc.list_weights(patient_id, current_user.clinic_id)
    return [_weight_to_dict(w) for w in weights]


@router.put("/{patient_id}/recovery-weights")
async def update_recovery_weights(
    patient_id: uuid.UUID,
    body: RecoveryWeightsBulkUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    svc = RecoveryService(session)
    weights = await svc.bulk_upsert_weights(
        patient_id, current_user.clinic_id, current_user.id,
        [w.model_dump() for w in body.weights],
    )
    await session.commit()
    return [_weight_to_dict(w) for w in weights]
