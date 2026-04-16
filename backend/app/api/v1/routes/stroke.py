from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.stroke import (
    AssessmentCreate,
    AssessmentUpdate,
    GoalCreate,
    GoalUpdate,
    ProgressCreate,
)
from app.services.stroke import StrokeService

router = APIRouter(prefix="/patients", tags=["Stroke Rehabilitation"])


def _assessment_to_dict(a) -> dict:
    assessed_by_name = None
    if a.assessed_by:
        assessed_by_name = f"{a.assessed_by.last_name} {a.assessed_by.first_name}"
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "assessed_by_id": a.assessed_by_id,
        "assessed_by_name": assessed_by_name,
        "assessment_type": a.assessment_type.value,
        "score": float(a.score) if a.score is not None else None,
        "max_score": float(a.max_score) if a.max_score is not None else None,
        "responses": a.responses,
        "interpretation": a.interpretation,
        "assessed_at": a.assessed_at,
        "notes": a.notes,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


def _goal_to_dict(g) -> dict:
    set_by_name = None
    if g.set_by:
        set_by_name = f"{g.set_by.last_name} {g.set_by.first_name}"
    return {
        "id": g.id,
        "patient_id": g.patient_id,
        "domain": g.domain.value,
        "description": g.description,
        "target_date": g.target_date,
        "baseline_value": g.baseline_value,
        "target_value": g.target_value,
        "current_value": g.current_value,
        "status": g.status.value,
        "set_by_id": g.set_by_id,
        "set_by_name": set_by_name,
        "created_at": g.created_at,
        "updated_at": g.updated_at,
    }


def _progress_to_dict(p) -> dict:
    recorded_by_name = None
    if p.recorded_by:
        recorded_by_name = f"{p.recorded_by.last_name} {p.recorded_by.first_name}"
    return {
        "id": p.id,
        "goal_id": p.goal_id,
        "recorded_by_id": p.recorded_by_id,
        "recorded_by_name": recorded_by_name,
        "value": p.value,
        "notes": p.notes,
        "recorded_at": p.recorded_at,
        "created_at": p.created_at,
    }


# ------------------------------------------------------------------
# Assessment endpoints
# ------------------------------------------------------------------


@router.get("/{patient_id}/stroke/assessments/latest")
async def get_latest_assessments(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    latest = await service.get_latest_assessments(patient_id, current_user.clinic_id)
    return {
        atype: _assessment_to_dict(a)
        for atype, a in latest.items()
    }


@router.get("/{patient_id}/stroke/assessments")
async def list_assessments(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    assessment_type: str | None = Query(None),
):
    service = StrokeService(session)
    assessments = await service.list_assessments(
        patient_id, current_user.clinic_id, assessment_type
    )
    return [_assessment_to_dict(a) for a in assessments]


@router.post("/{patient_id}/stroke/assessments", status_code=201)
async def create_assessment(
    patient_id: uuid.UUID,
    data: AssessmentCreate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    assessment = await service.create_assessment(
        patient_id, data.model_dump(), current_user.id, current_user.clinic_id
    )
    return _assessment_to_dict(assessment)


@router.get("/{patient_id}/stroke/assessments/{assessment_id}")
async def get_assessment(
    patient_id: uuid.UUID,
    assessment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    assessment = await service.get_assessment(
        assessment_id, patient_id, current_user.clinic_id
    )
    return _assessment_to_dict(assessment)


@router.patch("/{patient_id}/stroke/assessments/{assessment_id}")
async def update_assessment(
    patient_id: uuid.UUID,
    assessment_id: uuid.UUID,
    data: AssessmentUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    assessment = await service.update_assessment(
        assessment_id, patient_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _assessment_to_dict(assessment)


@router.delete("/{patient_id}/stroke/assessments/{assessment_id}", status_code=204)
async def delete_assessment(
    patient_id: uuid.UUID,
    assessment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    await service.delete_assessment(assessment_id, patient_id, current_user.clinic_id)


# ------------------------------------------------------------------
# Rehab goal endpoints
# ------------------------------------------------------------------


@router.get("/{patient_id}/stroke/goals")
async def list_goals(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    domain: str | None = Query(None),
    status: str | None = Query(None),
):
    service = StrokeService(session)
    goals = await service.list_goals(
        patient_id, current_user.clinic_id, domain, status
    )
    return [_goal_to_dict(g) for g in goals]


@router.post("/{patient_id}/stroke/goals", status_code=201)
async def create_goal(
    patient_id: uuid.UUID,
    data: GoalCreate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    goal = await service.create_goal(
        patient_id, data.model_dump(), current_user.id, current_user.clinic_id
    )
    return _goal_to_dict(goal)


@router.patch("/{patient_id}/stroke/goals/{goal_id}")
async def update_goal(
    patient_id: uuid.UUID,
    goal_id: uuid.UUID,
    data: GoalUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    goal = await service.update_goal(
        goal_id, patient_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _goal_to_dict(goal)


@router.delete("/{patient_id}/stroke/goals/{goal_id}", status_code=204)
async def delete_goal(
    patient_id: uuid.UUID,
    goal_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    await service.delete_goal(goal_id, patient_id, current_user.clinic_id)


# ------------------------------------------------------------------
# Progress endpoints
# ------------------------------------------------------------------


@router.post("/{patient_id}/stroke/goals/{goal_id}/progress", status_code=201)
async def add_progress(
    patient_id: uuid.UUID,
    goal_id: uuid.UUID,
    data: ProgressCreate,
    session: DBSession,
    current_user: CurrentUser,
    _auth=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = StrokeService(session)
    record = await service.add_progress(
        goal_id, patient_id, data.model_dump(), current_user.id, current_user.clinic_id
    )
    return _progress_to_dict(record)


@router.get("/{patient_id}/stroke/goals/{goal_id}/progress")
async def get_progress_history(
    patient_id: uuid.UUID,
    goal_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    records = await service.list_progress(goal_id, patient_id, current_user.clinic_id)
    return [_progress_to_dict(p) for p in records]


# ------------------------------------------------------------------
# Exercise assignment & session endpoints
# ------------------------------------------------------------------


@router.get("/{patient_id}/stroke/exercises")
async def get_patient_exercises(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    return await service.get_patient_exercises(patient_id, current_user.clinic_id)


@router.get("/{patient_id}/stroke/sessions")
async def get_exercise_sessions(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    return await service.get_exercise_sessions(patient_id, current_user.clinic_id)


# ------------------------------------------------------------------
# Aggregated progress
# ------------------------------------------------------------------


@router.get("/{patient_id}/stroke/progress")
async def get_aggregated_progress(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = StrokeService(session)
    return await service.get_aggregated_progress(patient_id, current_user.clinic_id)
