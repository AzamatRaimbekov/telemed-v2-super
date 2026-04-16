import uuid
from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DBSession, CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.laboratory import (
    LabTestCatalogOut,
    LabTestCatalogCreate,
    LabOrderCreate,
    LabOrderOut,
    LabOrderUpdate,
    LabResultCreate,
    LabResultUpdate,
    LabResultOut,
    LabStatsOut,
)
from app.services.laboratory import LaboratoryService

router = APIRouter(prefix="/laboratory", tags=["laboratory"])


# ── Catalog ──────────────────────────────────────────────────

@router.get("/catalog", response_model=list[LabTestCatalogOut])
async def list_catalog(
    session: DBSession,
    user: CurrentUser,
    search: str | None = None,
    category: str | None = None,
):
    svc = LaboratoryService(session)
    return await svc.get_catalog(user.clinic_id, search=search, category=category)


@router.post(
    "/catalog",
    response_model=LabTestCatalogOut,
    dependencies=[require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN)],
)
async def create_test(
    data: LabTestCatalogCreate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    return await svc.create_test(user.clinic_id, data)


@router.patch(
    "/catalog/{test_id}",
    response_model=LabTestCatalogOut,
    dependencies=[require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN)],
)
async def update_test(
    test_id: uuid.UUID,
    data: LabTestCatalogCreate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    result = await svc.update_test(test_id, user.clinic_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Test not found")
    return result


@router.delete(
    "/catalog/{test_id}",
    dependencies=[require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN)],
)
async def delete_test(
    test_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    deleted = await svc.delete_test(test_id, user.clinic_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"ok": True}


# ── Orders ───────────────────────────────────────────────────

@router.get("/orders", response_model=list[LabOrderOut])
async def list_orders(
    session: DBSession,
    user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    status: str | None = None,
    priority: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    svc = LaboratoryService(session)
    return await svc.get_orders(
        user.clinic_id,
        patient_id=patient_id,
        status=status,
        priority=priority,
        skip=skip,
        limit=limit,
    )


@router.get("/orders/{order_id}", response_model=LabOrderOut)
async def get_order(
    order_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    result = await svc.get_order(order_id, user.clinic_id)
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.post(
    "/orders",
    response_model=LabOrderOut,
    dependencies=[require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN)],
)
async def create_order(
    data: LabOrderCreate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    order = await svc.create_order(user.clinic_id, user.id, data)
    return await svc.get_order(order.id, user.clinic_id)


@router.patch("/orders/{order_id}", response_model=LabOrderOut)
async def update_order(
    order_id: uuid.UUID,
    data: LabOrderUpdate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    result = await svc.update_order(order_id, user.clinic_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


# ── Results ──────────────────────────────────────────────────

@router.post("/results", response_model=LabResultOut)
async def create_result(
    data: LabResultCreate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    try:
        lab_result = await svc.create_result(user.clinic_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Return enriched result
    results = await svc.get_results(user.clinic_id)
    for r in results:
        if r.id == lab_result.id:
            return r
    # Fallback: return bare result
    return LabResultOut(
        id=lab_result.id,
        lab_order_id=lab_result.lab_order_id,
        value=lab_result.value,
        numeric_value=float(lab_result.numeric_value) if lab_result.numeric_value is not None else None,
        unit=lab_result.unit,
        reference_range=lab_result.reference_range,
        is_abnormal=lab_result.is_abnormal,
        notes=lab_result.notes,
        status=lab_result.status.value,
        visible_to_patient=lab_result.visible_to_patient,
        resulted_at=lab_result.resulted_at,
        approved_at=lab_result.approved_at,
        approved_by_id=lab_result.approved_by_id,
    )


@router.patch("/results/{result_id}", response_model=LabResultOut)
async def update_result(
    result_id: uuid.UUID,
    data: LabResultUpdate,
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    lab_result = await svc.update_result(result_id, user.clinic_id, data)
    if not lab_result:
        raise HTTPException(status_code=404, detail="Result not found")
    # Return enriched
    results = await svc.get_results(user.clinic_id)
    for r in results:
        if r.id == lab_result.id:
            return r
    return LabResultOut(
        id=lab_result.id,
        lab_order_id=lab_result.lab_order_id,
        value=lab_result.value,
        numeric_value=float(lab_result.numeric_value) if lab_result.numeric_value is not None else None,
        unit=lab_result.unit,
        reference_range=lab_result.reference_range,
        is_abnormal=lab_result.is_abnormal,
        notes=lab_result.notes,
        status=lab_result.status.value,
        visible_to_patient=lab_result.visible_to_patient,
        resulted_at=lab_result.resulted_at,
        approved_at=lab_result.approved_at,
        approved_by_id=lab_result.approved_by_id,
    )


@router.get("/results", response_model=list[LabResultOut])
async def list_results(
    session: DBSession,
    user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    svc = LaboratoryService(session)
    return await svc.get_results(
        user.clinic_id,
        patient_id=patient_id,
        status=status,
        skip=skip,
        limit=limit,
    )


# ── Stats ────────────────────────────────────────────────────

@router.get("/stats", response_model=LabStatsOut)
async def get_stats(
    session: DBSession,
    user: CurrentUser,
):
    svc = LaboratoryService(session)
    return await svc.get_stats(user.clinic_id)
