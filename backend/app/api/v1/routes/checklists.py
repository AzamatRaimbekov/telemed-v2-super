from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_

from app.api.deps import CurrentUser, DBSession
from app.models.checklist import ChecklistTemplate, ChecklistInstance
from app.models.patient import Patient

router = APIRouter(prefix="/checklists", tags=["Compliance Checklists (Чек-листы)"])


# ---------- schemas ----------

class CreateTemplateRequest(BaseModel):
    name: str
    category: str = "nursing"
    items: list[dict]  # [{"id": "1", "text": "...", "required": true}, ...]
    description: str | None = None


class UpdateTemplateRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    items: list[dict] | None = None
    description: str | None = None


class FillChecklistRequest(BaseModel):
    template_id: uuid.UUID
    patient_id: uuid.UUID
    responses: dict  # {"1": {"checked": true, "note": ""}, ...}
    notes: str | None = None
    checklist_date: date | None = None


# ---------- helpers ----------

def _template_to_dict(t: ChecklistTemplate) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "category": t.category,
        "items": t.items,
        "description": t.description,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _instance_to_dict(ci: ChecklistInstance) -> dict:
    return {
        "id": str(ci.id),
        "template_id": str(ci.template_id),
        "patient_id": str(ci.patient_id),
        "completed_by_id": str(ci.completed_by_id),
        "checklist_date": ci.checklist_date.isoformat() if ci.checklist_date else None,
        "responses": ci.responses,
        "is_complete": ci.is_complete,
        "completion_percent": ci.completion_percent,
        "notes": ci.notes,
        "created_at": ci.created_at.isoformat() if ci.created_at else None,
    }


def _calc_completion(items: list[dict], responses: dict) -> tuple[bool, int]:
    """Calculate completion status and percentage."""
    if not items:
        return True, 100
    total = len(items)
    checked = sum(1 for item in items if responses.get(item.get("id", ""), {}).get("checked", False))
    pct = round(checked / total * 100) if total else 0
    required_items = [i for i in items if i.get("required", False)]
    all_required_done = all(
        responses.get(i.get("id", ""), {}).get("checked", False) for i in required_items
    )
    return all_required_done and checked == total, pct


# ---------- template CRUD ----------

@router.get("/templates")
async def list_templates(
    session: DBSession,
    current_user: CurrentUser,
    category: str | None = None,
):
    """List checklist templates."""
    q = select(ChecklistTemplate).where(
        ChecklistTemplate.clinic_id == current_user.clinic_id,
        ChecklistTemplate.is_deleted == False,
    )
    if category:
        q = q.where(ChecklistTemplate.category == category)
    q = q.order_by(ChecklistTemplate.created_at.desc())
    rows = (await session.execute(q)).scalars().all()
    return [_template_to_dict(t) for t in rows]


@router.post("/templates")
async def create_template(
    data: CreateTemplateRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new checklist template."""
    if not data.items:
        raise HTTPException(400, "Чек-лист должен содержать хотя бы один пункт")

    tmpl = ChecklistTemplate(
        clinic_id=current_user.clinic_id,
        name=data.name,
        category=data.category,
        items=data.items,
        description=data.description,
    )
    session.add(tmpl)
    await session.flush()
    return _template_to_dict(tmpl)


@router.put("/templates/{template_id}")
async def update_template(
    template_id: uuid.UUID,
    data: UpdateTemplateRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a checklist template."""
    tmpl = (await session.execute(
        select(ChecklistTemplate).where(ChecklistTemplate.id == template_id)
    )).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "Шаблон не найден")

    if data.name is not None:
        tmpl.name = data.name
    if data.category is not None:
        tmpl.category = data.category
    if data.items is not None:
        if not data.items:
            raise HTTPException(400, "Чек-лист должен содержать хотя бы один пункт")
        tmpl.items = data.items
    if data.description is not None:
        tmpl.description = data.description

    await session.flush()
    return _template_to_dict(tmpl)


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a checklist template."""
    tmpl = (await session.execute(
        select(ChecklistTemplate).where(ChecklistTemplate.id == template_id)
    )).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "Шаблон не найден")
    tmpl.is_deleted = True
    await session.flush()
    return {"status": "deleted"}


# ---------- fill & query ----------

@router.post("/fill")
async def fill_checklist(
    data: FillChecklistRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Fill a checklist for a patient."""
    tmpl = (await session.execute(
        select(ChecklistTemplate).where(ChecklistTemplate.id == data.template_id, ChecklistTemplate.is_deleted == False)
    )).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "Шаблон не найден")

    patient = (await session.execute(
        select(Patient).where(Patient.id == data.patient_id)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Пациент не найден")

    is_complete, pct = _calc_completion(tmpl.items, data.responses)

    ci = ChecklistInstance(
        clinic_id=current_user.clinic_id,
        template_id=data.template_id,
        patient_id=data.patient_id,
        completed_by_id=current_user.id,
        checklist_date=data.checklist_date or date.today(),
        responses=data.responses,
        is_complete=is_complete,
        completion_percent=pct,
        notes=data.notes,
    )
    session.add(ci)
    await session.flush()
    return _instance_to_dict(ci)


@router.get("/patient/{patient_id}")
async def patient_checklists(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Get completed checklists for a patient."""
    q = select(ChecklistInstance).where(
        ChecklistInstance.patient_id == patient_id,
        ChecklistInstance.is_deleted == False,
    )
    if date_from:
        q = q.where(ChecklistInstance.checklist_date >= date_from)
    if date_to:
        q = q.where(ChecklistInstance.checklist_date <= date_to)
    q = q.order_by(ChecklistInstance.checklist_date.desc())
    rows = (await session.execute(q)).scalars().all()
    return [_instance_to_dict(ci) for ci in rows]


@router.get("/compliance-report")
async def compliance_report(
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Completion rates report by nurse."""
    q = select(
        ChecklistInstance.completed_by_id,
        func.count(ChecklistInstance.id).label("total"),
        func.avg(ChecklistInstance.completion_percent).label("avg_completion"),
        func.sum(func.cast(ChecklistInstance.is_complete, type_=None)).label("fully_complete"),
    ).where(
        ChecklistInstance.clinic_id == current_user.clinic_id,
        ChecklistInstance.is_deleted == False,
    ).group_by(ChecklistInstance.completed_by_id)

    if date_from:
        q = q.where(ChecklistInstance.checklist_date >= date_from)
    if date_to:
        q = q.where(ChecklistInstance.checklist_date <= date_to)

    rows = (await session.execute(q)).all()
    return [
        {
            "completed_by_id": str(r.completed_by_id),
            "total_checklists": r.total,
            "avg_completion_percent": round(float(r.avg_completion or 0), 1),
            "fully_complete": int(r.fully_complete or 0),
        }
        for r in rows
    ]


@router.get("/overdue")
async def overdue_checklists(
    session: DBSession,
    current_user: CurrentUser,
):
    """Patients without today's required checklists."""
    today = date.today()

    # Get all active patients in clinic
    patients_q = select(Patient.id, Patient.first_name, Patient.last_name).where(
        Patient.clinic_id == current_user.clinic_id,
        Patient.is_deleted == False,
    )
    patients = (await session.execute(patients_q)).all()

    # Get today's completed checklist patient IDs
    done_q = select(ChecklistInstance.patient_id).where(
        ChecklistInstance.clinic_id == current_user.clinic_id,
        ChecklistInstance.checklist_date == today,
        ChecklistInstance.is_deleted == False,
    ).distinct()
    done_patient_ids = set(r[0] for r in (await session.execute(done_q)).all())

    # Get required templates count
    templates_q = select(func.count(ChecklistTemplate.id)).where(
        ChecklistTemplate.clinic_id == current_user.clinic_id,
        ChecklistTemplate.is_deleted == False,
    )
    template_count = (await session.execute(templates_q)).scalar() or 0

    overdue = [
        {
            "patient_id": str(p.id),
            "patient_name": f"{p.last_name} {p.first_name}",
            "missing_checklists": template_count,
        }
        for p in patients
        if p.id not in done_patient_ids
    ]

    return {"date": today.isoformat(), "total_templates": template_count, "overdue_patients": overdue}


@router.get("/{checklist_id}")
async def get_checklist(
    checklist_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get checklist instance detail."""
    ci = (await session.execute(
        select(ChecklistInstance).where(ChecklistInstance.id == checklist_id)
    )).scalar_one_or_none()
    if not ci:
        raise HTTPException(404, "Чек-лист не найден")
    return _instance_to_dict(ci)
