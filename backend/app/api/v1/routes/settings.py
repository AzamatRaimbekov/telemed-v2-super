from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.settings import (
    ExerciseCreate,
    ExerciseUpdate,
    DrugCreate,
    DrugUpdate,
    ProcedureCreate,
    ProcedureUpdate,
    LabTestCreate,
    LabTestUpdate,
)
from app.services.settings import SettingsService

router = APIRouter(prefix="/settings", tags=["Medicine Settings"])

_admin = require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)


# ── helpers ───────────────────────────────────────────────────────────────────


def _serialize_exercise(e):  # type: ignore[no-untyped-def]
    return {
        "id": e.id,
        "name": e.name,
        "description": e.description,
        "category": e.category.value if e.category else None,
        "difficulty": e.difficulty.value if e.difficulty else None,
        "instructions": e.instructions,
        "demo_video_url": e.demo_video_url,
        "default_sets": e.default_sets,
        "default_reps": e.default_reps,
        "target_joints": e.target_joints,
        "angle_thresholds": e.angle_thresholds,
        "is_active": e.is_active,
        "created_at": e.created_at,
        "updated_at": e.updated_at,
    }


def _serialize_drug(d):  # type: ignore[no-untyped-def]
    return {
        "id": d.id,
        "name": d.name,
        "generic_name": d.generic_name,
        "brand": d.brand,
        "category": d.category,
        "form": d.form.value if d.form else None,
        "unit": d.unit,
        "price": float(d.price) if d.price is not None else None,
        "requires_prescription": d.requires_prescription,
        "interactions": d.interactions,
        "contraindications": d.contraindications,
        "is_active": d.is_active,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


def _serialize_procedure(p):  # type: ignore[no-untyped-def]
    return {
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "category": p.category,
        "description": p.description,
        "duration_minutes": p.duration_minutes,
        "price": float(p.price) if p.price is not None else None,
        "requires_consent": p.requires_consent,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


def _serialize_lab_test(t):  # type: ignore[no-untyped-def]
    return {
        "id": t.id,
        "name": t.name,
        "code": t.code,
        "category": t.category,
        "description": t.description,
        "reference_ranges": t.reference_ranges,
        "price": float(t.price) if t.price is not None else None,
        "turnaround_hours": t.turnaround_hours,
        "sample_type": t.sample_type,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Stats
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/stats")
async def get_stats(session: DBSession, current_user: CurrentUser):
    service = SettingsService(session)
    return await service.get_stats(current_user.clinic_id)


# ══════════════════════════════════════════════════════════════════════════════
# Exercise CRUD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/exercises")
async def list_exercises(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
    difficulty: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = SettingsService(session)
    items, total = await service.list_exercises(
        current_user.clinic_id, search, category, difficulty, skip, limit
    )
    return {
        "items": [_serialize_exercise(e) for e in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/exercises", status_code=201)
async def create_exercise(
    data: ExerciseCreate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    exercise = await service.create_exercise(data.model_dump(), current_user.clinic_id)
    return _serialize_exercise(exercise)


@router.get("/exercises/{exercise_id}")
async def get_exercise(
    exercise_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    exercise = await service.get_exercise(exercise_id, current_user.clinic_id)
    return _serialize_exercise(exercise)


@router.patch("/exercises/{exercise_id}")
async def update_exercise(
    exercise_id: uuid.UUID,
    data: ExerciseUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    exercise = await service.update_exercise(
        exercise_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _serialize_exercise(exercise)


@router.delete("/exercises/{exercise_id}", status_code=204)
async def delete_exercise(
    exercise_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    await service.delete_exercise(exercise_id, current_user.clinic_id)


@router.post("/exercises/{exercise_id}/toggle")
async def toggle_exercise(
    exercise_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    exercise = await service.toggle_exercise(exercise_id, current_user.clinic_id)
    return {"id": exercise.id, "is_active": exercise.is_active}


@router.post("/exercises/import", status_code=201)
async def import_exercises(
    items: list[ExerciseCreate],
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    created = await service.bulk_create_exercises(
        [item.model_dump() for item in items], current_user.clinic_id
    )
    return {"imported": len(created), "items": [_serialize_exercise(e) for e in created]}


# ══════════════════════════════════════════════════════════════════════════════
# Drug CRUD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/drugs/categories")
async def get_drug_categories(
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    categories = await service.get_drug_categories(current_user.clinic_id)
    return categories


@router.get("/drugs")
async def list_drugs(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
    form: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = SettingsService(session)
    items, total = await service.list_drugs(
        current_user.clinic_id, search, category, form, skip, limit
    )
    return {
        "items": [_serialize_drug(d) for d in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/drugs", status_code=201)
async def create_drug(
    data: DrugCreate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    drug = await service.create_drug(data.model_dump(), current_user.clinic_id)
    return _serialize_drug(drug)


@router.get("/drugs/{drug_id}")
async def get_drug(
    drug_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    drug = await service.get_drug(drug_id, current_user.clinic_id)
    return _serialize_drug(drug)


@router.patch("/drugs/{drug_id}")
async def update_drug(
    drug_id: uuid.UUID,
    data: DrugUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    drug = await service.update_drug(
        drug_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _serialize_drug(drug)


@router.delete("/drugs/{drug_id}", status_code=204)
async def delete_drug(
    drug_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    await service.delete_drug(drug_id, current_user.clinic_id)


@router.post("/drugs/{drug_id}/toggle")
async def toggle_drug(
    drug_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    drug = await service.toggle_drug(drug_id, current_user.clinic_id)
    return {"id": drug.id, "is_active": drug.is_active}


# ══════════════════════════════════════════════════════════════════════════════
# Procedure CRUD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/procedures/categories")
async def get_procedure_categories(
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    categories = await service.get_procedure_categories(current_user.clinic_id)
    return categories


@router.get("/procedures")
async def list_procedures(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = SettingsService(session)
    items, total = await service.list_procedures(
        current_user.clinic_id, search, category, skip, limit
    )
    return {
        "items": [_serialize_procedure(p) for p in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/procedures", status_code=201)
async def create_procedure(
    data: ProcedureCreate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    procedure = await service.create_procedure(data.model_dump(), current_user.clinic_id)
    return _serialize_procedure(procedure)


@router.get("/procedures/{procedure_id}")
async def get_procedure(
    procedure_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    procedure = await service.get_procedure(procedure_id, current_user.clinic_id)
    return _serialize_procedure(procedure)


@router.patch("/procedures/{procedure_id}")
async def update_procedure(
    procedure_id: uuid.UUID,
    data: ProcedureUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    procedure = await service.update_procedure(
        procedure_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _serialize_procedure(procedure)


@router.delete("/procedures/{procedure_id}", status_code=204)
async def delete_procedure(
    procedure_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    await service.delete_procedure(procedure_id, current_user.clinic_id)


# ══════════════════════════════════════════════════════════════════════════════
# Lab Test CRUD
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/lab-tests/categories")
async def get_lab_test_categories(
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    categories = await service.get_lab_test_categories(current_user.clinic_id)
    return categories


@router.get("/lab-tests")
async def list_lab_tests(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = SettingsService(session)
    items, total = await service.list_lab_tests(
        current_user.clinic_id, search, category, skip, limit
    )
    return {
        "items": [_serialize_lab_test(t) for t in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/lab-tests", status_code=201)
async def create_lab_test(
    data: LabTestCreate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    lab_test = await service.create_lab_test(data.model_dump(), current_user.clinic_id)
    return _serialize_lab_test(lab_test)


@router.get("/lab-tests/{lab_test_id}")
async def get_lab_test(
    lab_test_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = SettingsService(session)
    lab_test = await service.get_lab_test(lab_test_id, current_user.clinic_id)
    return _serialize_lab_test(lab_test)


@router.patch("/lab-tests/{lab_test_id}")
async def update_lab_test(
    lab_test_id: uuid.UUID,
    data: LabTestUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    lab_test = await service.update_lab_test(
        lab_test_id, data.model_dump(exclude_unset=True), current_user.clinic_id
    )
    return _serialize_lab_test(lab_test)


@router.delete("/lab-tests/{lab_test_id}", status_code=204)
async def delete_lab_test(
    lab_test_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _admin_user=_admin,
):
    service = SettingsService(session)
    await service.delete_lab_test(lab_test_id, current_user.clinic_id)
