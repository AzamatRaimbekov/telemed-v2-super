from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.treatment_template import TreatmentTemplate
from app.models.treatment import (
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStatus,
    TreatmentItemType,
    TreatmentItemStatus,
)

router = APIRouter(prefix="/treatment-templates", tags=["Treatment Templates (ICD-10)"])


# ---------- schemas ----------


class MedicationItem(BaseModel):
    name: str
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None


class ProcedureItem(BaseModel):
    name: str
    frequency: str | None = None


class TemplateCreate(BaseModel):
    icd10_code: str
    icd10_name: str
    template_name: str
    medications: list[MedicationItem] | None = None
    procedures: list[ProcedureItem] | None = None
    recommendations: str | None = None
    diet: str | None = None


class TemplateUpdate(BaseModel):
    icd10_code: str | None = None
    icd10_name: str | None = None
    template_name: str | None = None
    medications: list[MedicationItem] | None = None
    procedures: list[ProcedureItem] | None = None
    recommendations: str | None = None
    diet: str | None = None


class ApplyTemplateRequest(BaseModel):
    patient_id: uuid.UUID


# ---------- helpers ----------


def _template_to_dict(t: TreatmentTemplate) -> dict:
    return {
        "id": str(t.id),
        "icd10_code": t.icd10_code,
        "icd10_name": t.icd10_name,
        "template_name": t.template_name,
        "medications": t.medications,
        "procedures": t.procedures,
        "recommendations": t.recommendations,
        "diet": t.diet,
        "created_by_id": str(t.created_by_id) if t.created_by_id else None,
        "clinic_id": str(t.clinic_id),
        "created_at": t.created_at.isoformat(),
    }


# ---------- endpoints ----------


@router.get("/")
async def list_templates(
    session: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """List all treatment templates for the clinic."""
    q = (
        select(TreatmentTemplate)
        .where(
            TreatmentTemplate.clinic_id == current_user.clinic_id,
            TreatmentTemplate.is_deleted == False,
        )
        .offset(skip)
        .limit(limit)
        .order_by(TreatmentTemplate.icd10_code)
    )
    result = await session.execute(q)
    templates = result.scalars().all()
    return [_template_to_dict(t) for t in templates]


@router.get("/by-icd/{icd10_code}")
async def get_by_icd_code(
    icd10_code: str,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get treatment templates for a specific ICD-10 diagnosis code."""
    q = select(TreatmentTemplate).where(
        TreatmentTemplate.clinic_id == current_user.clinic_id,
        TreatmentTemplate.icd10_code == icd10_code,
        TreatmentTemplate.is_deleted == False,
    )
    result = await session.execute(q)
    templates = result.scalars().all()
    if not templates:
        raise HTTPException(status_code=404, detail=f"Шаблоны для кода {icd10_code} не найдены")
    return [_template_to_dict(t) for t in templates]


@router.post("/")
async def create_template(
    body: TemplateCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new treatment template."""
    template = TreatmentTemplate(
        clinic_id=current_user.clinic_id,
        icd10_code=body.icd10_code,
        icd10_name=body.icd10_name,
        template_name=body.template_name,
        medications=[m.model_dump() for m in body.medications] if body.medications else None,
        procedures=[p.model_dump() for p in body.procedures] if body.procedures else None,
        recommendations=body.recommendations,
        diet=body.diet,
        created_by_id=current_user.id,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return _template_to_dict(template)


@router.put("/{template_id}")
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update an existing treatment template."""
    result = await session.execute(
        select(TreatmentTemplate).where(
            TreatmentTemplate.id == template_id,
            TreatmentTemplate.clinic_id == current_user.clinic_id,
            TreatmentTemplate.is_deleted == False,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")

    for field in ("icd10_code", "icd10_name", "template_name", "recommendations", "diet"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(template, field, val)
    if body.medications is not None:
        template.medications = [m.model_dump() for m in body.medications]
    if body.procedures is not None:
        template.procedures = [p.model_dump() for p in body.procedures]

    await session.commit()
    await session.refresh(template)
    return _template_to_dict(template)


@router.delete("/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a treatment template."""
    result = await session.execute(
        select(TreatmentTemplate).where(
            TreatmentTemplate.id == template_id,
            TreatmentTemplate.clinic_id == current_user.clinic_id,
            TreatmentTemplate.is_deleted == False,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")

    template.is_deleted = True
    await session.commit()
    return {"ok": True, "message": "Шаблон удалён"}


@router.post("/{template_id}/apply")
async def apply_template(
    template_id: uuid.UUID,
    body: ApplyTemplateRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Apply a treatment template to a patient — creates a TreatmentPlan with items."""
    result = await session.execute(
        select(TreatmentTemplate).where(
            TreatmentTemplate.id == template_id,
            TreatmentTemplate.clinic_id == current_user.clinic_id,
            TreatmentTemplate.is_deleted == False,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")

    # Create treatment plan
    plan = TreatmentPlan(
        clinic_id=current_user.clinic_id,
        patient_id=body.patient_id,
        doctor_id=current_user.id,
        title=f"{template.template_name} ({template.icd10_code})",
        description=template.recommendations,
        status=TreatmentPlanStatus.DRAFT,
        start_date=date.today(),
    )
    session.add(plan)
    await session.flush()

    sort_order = 0

    # Add medication items
    for med in (template.medications or []):
        item = TreatmentPlanItem(
            clinic_id=current_user.clinic_id,
            treatment_plan_id=plan.id,
            item_type=TreatmentItemType.MEDICATION,
            title=med.get("name", "Препарат"),
            description=f"Дозировка: {med.get('dosage', '-')}, Частота: {med.get('frequency', '-')}, Длительность: {med.get('duration', '-')}",
            frequency=med.get("frequency"),
            status=TreatmentItemStatus.PENDING,
            sort_order=sort_order,
            start_date=date.today(),
        )
        session.add(item)
        sort_order += 1

    # Add procedure items
    for proc in (template.procedures or []):
        item = TreatmentPlanItem(
            clinic_id=current_user.clinic_id,
            treatment_plan_id=plan.id,
            item_type=TreatmentItemType.PROCEDURE,
            title=proc.get("name", "Процедура"),
            description=f"Частота: {proc.get('frequency', '-')}",
            frequency=proc.get("frequency"),
            status=TreatmentItemStatus.PENDING,
            sort_order=sort_order,
            start_date=date.today(),
        )
        session.add(item)
        sort_order += 1

    # Add diet item if present
    if template.diet:
        item = TreatmentPlanItem(
            clinic_id=current_user.clinic_id,
            treatment_plan_id=plan.id,
            item_type=TreatmentItemType.DIET,
            title=f"Диета: {template.diet}",
            description=template.diet,
            status=TreatmentItemStatus.PENDING,
            sort_order=sort_order,
            start_date=date.today(),
        )
        session.add(item)

    await session.commit()
    await session.refresh(plan)

    return {
        "ok": True,
        "message": f"План лечения создан на основе шаблона '{template.template_name}'",
        "treatment_plan_id": str(plan.id),
        "template_id": str(template.id),
        "icd10_code": template.icd10_code,
        "items_created": sort_order + (1 if template.diet else 0),
    }
