from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.treatment import (
    TreatmentPlanCreateFull,
    TreatmentPlanUpdate,
    TreatmentItemCreate,
    TreatmentItemUpdate,
    ItemReorder,
)
from app.services.treatment import TreatmentService

router = APIRouter(prefix="/treatment", tags=["Treatment Plans"])


# ------------------------------------------------------------------
# Catalog endpoints (for wizard dropdowns)
# ------------------------------------------------------------------


@router.get("/catalogs/drugs")
async def get_drug_catalog(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
):
    service = TreatmentService(session)
    drugs = await service.get_drug_catalog(current_user.clinic_id, search, category)
    return [
        {
            "id": d.id,
            "name": d.name,
            "generic_name": d.generic_name,
            "form": d.form.value,
            "unit": d.unit,
            "category": d.category,
            "requires_prescription": d.requires_prescription,
        }
        for d in drugs
    ]


@router.get("/catalogs/procedures")
async def get_procedure_catalog(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
):
    service = TreatmentService(session)
    procedures = await service.get_procedure_catalog(current_user.clinic_id, search, category)
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "category": p.category,
            "duration_minutes": p.duration_minutes,
            "description": p.description,
        }
        for p in procedures
    ]


@router.get("/catalogs/lab-tests")
async def get_lab_test_catalog(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
):
    service = TreatmentService(session)
    tests = await service.get_lab_test_catalog(current_user.clinic_id, search, category)
    return [
        {
            "id": t.id,
            "name": t.name,
            "code": t.code,
            "category": t.category,
            "turnaround_hours": t.turnaround_hours,
            "sample_type": t.sample_type,
        }
        for t in tests
    ]


@router.get("/catalogs/exercises")
async def get_exercise_catalog(
    session: DBSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    category: str | None = Query(None),
):
    service = TreatmentService(session)
    exercises = await service.get_exercise_catalog(current_user.clinic_id, search, category)
    return [
        {
            "id": e.id,
            "name": e.name,
            "category": e.category.value,
            "difficulty": e.difficulty.value,
            "default_sets": e.default_sets,
            "default_reps": e.default_reps,
        }
        for e in exercises
    ]


# ------------------------------------------------------------------
# Plan CRUD
# ------------------------------------------------------------------


@router.post("/plans", status_code=201)
async def create_plan(
    data: TreatmentPlanCreateFull,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    plan = await service.create_plan_with_items(
        data.model_dump(),
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
    )
    return await service.get_plan_detail(plan.id, current_user.clinic_id)


@router.get("/plans/{plan_id}")
async def get_plan(
    plan_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = TreatmentService(session)
    return await service.get_plan_detail(plan_id, current_user.clinic_id)


@router.patch("/plans/{plan_id}")
async def update_plan(
    plan_id: uuid.UUID,
    data: TreatmentPlanUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    plan = await service.update_plan(plan_id, data.model_dump(exclude_unset=True), current_user.clinic_id)
    return {
        "id": plan.id,
        "title": plan.title,
        "description": plan.description,
        "status": plan.status.value,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "updated_at": plan.updated_at,
    }


@router.delete("/plans/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    await service.delete_plan(plan_id, current_user.clinic_id)


@router.post("/plans/{plan_id}/activate")
async def activate_plan(
    plan_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    plan = await service.activate_plan(plan_id, current_user.id, current_user.clinic_id)
    return await service.get_plan_detail(plan.id, current_user.clinic_id)


# ------------------------------------------------------------------
# Item CRUD
# ------------------------------------------------------------------


@router.post("/plans/{plan_id}/items", status_code=201)
async def add_item(
    plan_id: uuid.UUID,
    data: TreatmentItemCreate,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    item = await service.add_item(plan_id, data.model_dump(), current_user.clinic_id)
    return {
        "id": item.id,
        "item_type": item.item_type.value,
        "title": item.title,
        "description": item.description,
        "configuration": item.configuration,
        "frequency": item.frequency,
        "status": item.status.value,
        "sort_order": item.sort_order,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "assigned_to_id": item.assigned_to_id,
        "created_at": item.created_at,
    }


@router.patch("/plans/{plan_id}/items/{item_id}")
async def update_item(
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    data: TreatmentItemUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    item = await service.update_item(plan_id, item_id, data.model_dump(exclude_unset=True), current_user.clinic_id)
    return {
        "id": item.id,
        "item_type": item.item_type.value,
        "title": item.title,
        "description": item.description,
        "configuration": item.configuration,
        "frequency": item.frequency,
        "status": item.status.value,
        "sort_order": item.sort_order,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "assigned_to_id": item.assigned_to_id,
        "updated_at": item.updated_at,
    }


@router.delete("/plans/{plan_id}/items/{item_id}", status_code=204)
async def delete_item(
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    await service.delete_item(plan_id, item_id, current_user.clinic_id)


@router.post("/plans/{plan_id}/items/reorder")
async def reorder_items(
    plan_id: uuid.UUID,
    data: ItemReorder,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = TreatmentService(session)
    items = await service.reorder_items(plan_id, data.item_ids, current_user.clinic_id)
    return [
        {
            "id": i.id,
            "item_type": i.item_type.value,
            "title": i.title,
            "sort_order": i.sort_order,
        }
        for i in items
    ]
