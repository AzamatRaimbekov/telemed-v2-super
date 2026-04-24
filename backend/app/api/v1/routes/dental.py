from __future__ import annotations

import uuid
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.dental_chart import DentalChart, ToothTreatment, ToothStatus
from app.models.dental_procedure import DentalProcedure

router = APIRouter(prefix="/dental", tags=["Dental / Стоматология"])

# FDI tooth numbers: upper right 11-18, upper left 21-28, lower left 31-38, lower right 41-48
ALL_TEETH = (
    [11, 12, 13, 14, 15, 16, 17, 18]
    + [21, 22, 23, 24, 25, 26, 27, 28]
    + [31, 32, 33, 34, 35, 36, 37, 38]
    + [41, 42, 43, 44, 45, 46, 47, 48]
)


def _default_teeth() -> dict:
    return {
        str(t): {"status": "healthy", "notes": "", "treatments": []}
        for t in ALL_TEETH
    }


# ---------- schemas ----------


class ChartUpdate(BaseModel):
    teeth: dict | None = None
    notes: str | None = None


class TreatmentCreate(BaseModel):
    procedure_name: str
    diagnosis: str | None = None
    tooth_status_after: str = "filled"
    materials_used: str | None = None
    price: float | None = None
    notes: str | None = None


# ---------- helpers ----------


def _chart_to_dict(chart: DentalChart) -> dict:
    return {
        "id": str(chart.id),
        "patient_id": str(chart.patient_id),
        "teeth": chart.teeth,
        "notes": chart.notes,
        "created_at": chart.created_at.isoformat(),
        "updated_at": chart.updated_at.isoformat(),
    }


def _treatment_to_dict(t: ToothTreatment) -> dict:
    return {
        "id": str(t.id),
        "patient_id": str(t.patient_id),
        "tooth_number": t.tooth_number,
        "doctor_id": str(t.doctor_id),
        "procedure_name": t.procedure_name,
        "diagnosis": t.diagnosis,
        "tooth_status_before": t.tooth_status_before,
        "tooth_status_after": t.tooth_status_after,
        "materials_used": t.materials_used,
        "price": t.price,
        "notes": t.notes,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


def _procedure_to_dict(p: DentalProcedure) -> dict:
    return {
        "id": str(p.id),
        "code": p.code,
        "name": p.name,
        "category": p.category,
        "description": p.description,
        "base_price": p.base_price,
        "duration_minutes": p.duration_minutes,
        "is_active": p.is_active,
    }


# ---------- endpoints ----------


@router.get("/chart/{patient_id}")
async def get_dental_chart(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get dental chart for patient. Auto-creates default chart if not exists."""
    result = await session.execute(
        select(DentalChart).where(
            DentalChart.patient_id == patient_id,
            DentalChart.clinic_id == current_user.clinic_id,
            DentalChart.is_deleted == False,
        )
    )
    chart = result.scalar_one_or_none()
    if not chart:
        chart = DentalChart(
            id=uuid.uuid4(),
            clinic_id=current_user.clinic_id,
            patient_id=patient_id,
            teeth=_default_teeth(),
            notes=None,
        )
        session.add(chart)
        await session.commit()
        await session.refresh(chart)
    return _chart_to_dict(chart)


@router.put("/chart/{patient_id}")
async def update_dental_chart(
    patient_id: uuid.UUID,
    data: ChartUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update dental chart (teeth map and/or notes)."""
    result = await session.execute(
        select(DentalChart).where(
            DentalChart.patient_id == patient_id,
            DentalChart.clinic_id == current_user.clinic_id,
            DentalChart.is_deleted == False,
        )
    )
    chart = result.scalar_one_or_none()
    if not chart:
        return {"error": "Chart not found"}
    if data.teeth is not None:
        chart.teeth = data.teeth
    if data.notes is not None:
        chart.notes = data.notes
    await session.commit()
    await session.refresh(chart)
    return _chart_to_dict(chart)


@router.post("/chart/{patient_id}/tooth/{tooth_number}/treatment", status_code=201)
async def add_tooth_treatment(
    patient_id: uuid.UUID,
    tooth_number: int,
    data: TreatmentCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Add a treatment record to a specific tooth."""
    # Get or create chart
    result = await session.execute(
        select(DentalChart).where(
            DentalChart.patient_id == patient_id,
            DentalChart.clinic_id == current_user.clinic_id,
            DentalChart.is_deleted == False,
        )
    )
    chart = result.scalar_one_or_none()
    if not chart:
        chart = DentalChart(
            id=uuid.uuid4(),
            clinic_id=current_user.clinic_id,
            patient_id=patient_id,
            teeth=_default_teeth(),
        )
        session.add(chart)
        await session.flush()

    tooth_key = str(tooth_number)
    teeth = dict(chart.teeth)
    old_status = teeth.get(tooth_key, {}).get("status", "healthy")

    # Create treatment record
    treatment = ToothTreatment(
        id=uuid.uuid4(),
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        tooth_number=tooth_number,
        doctor_id=current_user.id,
        procedure_name=data.procedure_name,
        diagnosis=data.diagnosis,
        tooth_status_before=old_status,
        tooth_status_after=data.tooth_status_after,
        materials_used=data.materials_used,
        price=data.price,
        notes=data.notes,
    )
    session.add(treatment)

    # Update tooth status in chart
    if tooth_key in teeth:
        teeth[tooth_key]["status"] = data.tooth_status_after
    else:
        teeth[tooth_key] = {"status": data.tooth_status_after, "notes": "", "treatments": []}
    chart.teeth = teeth

    await session.commit()
    await session.refresh(treatment)
    return _treatment_to_dict(treatment)


@router.get("/chart/{patient_id}/tooth/{tooth_number}/history")
async def get_tooth_history(
    patient_id: uuid.UUID,
    tooth_number: int,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get treatment history for a specific tooth."""
    result = await session.execute(
        select(ToothTreatment).where(
            ToothTreatment.patient_id == patient_id,
            ToothTreatment.tooth_number == tooth_number,
            ToothTreatment.clinic_id == current_user.clinic_id,
            ToothTreatment.is_deleted == False,
        ).order_by(ToothTreatment.created_at.desc())
    )
    return [_treatment_to_dict(t) for t in result.scalars().all()]


@router.get("/treatments/{patient_id}")
async def get_patient_treatments(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get all dental treatments for a patient."""
    result = await session.execute(
        select(ToothTreatment).where(
            ToothTreatment.patient_id == patient_id,
            ToothTreatment.clinic_id == current_user.clinic_id,
            ToothTreatment.is_deleted == False,
        ).order_by(ToothTreatment.created_at.desc())
    )
    return [_treatment_to_dict(t) for t in result.scalars().all()]


@router.get("/procedures")
async def list_dental_procedures(
    session: DBSession,
    current_user: CurrentUser,
    category: str | None = None,
    search: str | None = None,
):
    """List dental procedure catalog."""
    q = select(DentalProcedure).where(
        DentalProcedure.clinic_id == current_user.clinic_id,
        DentalProcedure.is_deleted == False,
        DentalProcedure.is_active == True,
    )
    if category:
        q = q.where(DentalProcedure.category == category)
    if search:
        q = q.where(DentalProcedure.name.ilike(f"%{search}%"))
    q = q.order_by(DentalProcedure.category, DentalProcedure.code)
    result = await session.execute(q)
    return [_procedure_to_dict(p) for p in result.scalars().all()]
