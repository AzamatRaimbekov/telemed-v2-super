from __future__ import annotations

import os
import uuid
from datetime import date, datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.ortho_treatment import OrthoTreatment, OrthoType

router = APIRouter(prefix="/ortho", tags=["Orthodontics / Ортодонтия"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")


# ---------- schemas ----------


class OrthoCreate(BaseModel):
    patient_id: uuid.UUID
    ortho_type: OrthoType
    start_date: date
    estimated_end_date: date | None = None
    total_visits_planned: int = 24
    total_cost: float | None = None
    aligner_count: int | None = None
    notes: str | None = None


class OrthoUpdate(BaseModel):
    ortho_type: OrthoType | None = None
    estimated_end_date: date | None = None
    actual_end_date: date | None = None
    total_visits_planned: int | None = None
    total_cost: float | None = None
    paid_amount: float | None = None
    aligner_count: int | None = None
    current_aligner: int | None = None
    notes: str | None = None


class VisitRecord(BaseModel):
    notes: str | None = None
    paid: float | None = None
    next_aligner: int | None = None  # for aligners


# ---------- helpers ----------


def _ortho_to_dict(o: OrthoTreatment) -> dict:
    return {
        "id": str(o.id),
        "patient_id": str(o.patient_id),
        "doctor_id": str(o.doctor_id),
        "ortho_type": o.ortho_type.value if hasattr(o.ortho_type, "value") else o.ortho_type,
        "start_date": o.start_date.isoformat(),
        "estimated_end_date": o.estimated_end_date.isoformat() if o.estimated_end_date else None,
        "actual_end_date": o.actual_end_date.isoformat() if o.actual_end_date else None,
        "total_visits_planned": o.total_visits_planned,
        "visits_completed": o.visits_completed,
        "total_cost": o.total_cost,
        "paid_amount": o.paid_amount,
        "aligner_count": o.aligner_count,
        "current_aligner": o.current_aligner,
        "notes": o.notes,
        "progress_photos": o.progress_photos,
        "created_at": o.created_at.isoformat(),
        "updated_at": o.updated_at.isoformat(),
    }


# ---------- endpoints ----------


@router.post("/", status_code=201)
async def create_ortho_treatment(
    data: OrthoCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Start a new orthodontic treatment."""
    ortho = OrthoTreatment(
        id=uuid.uuid4(),
        clinic_id=current_user.clinic_id,
        patient_id=data.patient_id,
        doctor_id=current_user.id,
        ortho_type=data.ortho_type,
        start_date=data.start_date,
        estimated_end_date=data.estimated_end_date,
        total_visits_planned=data.total_visits_planned,
        total_cost=data.total_cost,
        paid_amount=0,
        aligner_count=data.aligner_count,
        current_aligner=1 if data.aligner_count else None,
        notes=data.notes,
        progress_photos=[],
    )
    session.add(ortho)
    await session.commit()
    await session.refresh(ortho)
    return _ortho_to_dict(ortho)


@router.get("/patient/{patient_id}")
async def get_patient_ortho(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get all ortho treatments for a patient."""
    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.patient_id == patient_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        ).order_by(OrthoTreatment.created_at.desc())
    )
    return [_ortho_to_dict(o) for o in result.scalars().all()]


@router.get("/{ortho_id}")
async def get_ortho_detail(
    ortho_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get ortho treatment detail."""
    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.id == ortho_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        )
    )
    ortho = result.scalar_one_or_none()
    if not ortho:
        return {"error": "Treatment not found"}
    return _ortho_to_dict(ortho)


@router.patch("/{ortho_id}")
async def update_ortho_treatment(
    ortho_id: uuid.UUID,
    data: OrthoUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update an ortho treatment."""
    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.id == ortho_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        )
    )
    ortho = result.scalar_one_or_none()
    if not ortho:
        return {"error": "Treatment not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ortho, field, value)
    await session.commit()
    await session.refresh(ortho)
    return _ortho_to_dict(ortho)


@router.post("/{ortho_id}/visit", status_code=201)
async def record_ortho_visit(
    ortho_id: uuid.UUID,
    data: VisitRecord,
    session: DBSession,
    current_user: CurrentUser,
):
    """Record a visit (increments visits_completed)."""
    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.id == ortho_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        )
    )
    ortho = result.scalar_one_or_none()
    if not ortho:
        return {"error": "Treatment not found"}
    ortho.visits_completed = (ortho.visits_completed or 0) + 1
    if data.paid:
        ortho.paid_amount = (ortho.paid_amount or 0) + data.paid
    if data.next_aligner is not None:
        ortho.current_aligner = data.next_aligner
    if data.notes:
        ortho.notes = data.notes
    await session.commit()
    await session.refresh(ortho)
    return _ortho_to_dict(ortho)


@router.post("/{ortho_id}/photo", status_code=201)
async def add_progress_photo(
    ortho_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    description: str = Form(""),
):
    """Add a progress photo to ortho treatment."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.id == ortho_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        )
    )
    ortho = result.scalar_one_or_none()
    if not ortho:
        raise HTTPException(404, "Treatment not found")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    ext = os.path.splitext(file.filename or "file")[1] or ".jpg"
    saved_name = f"ortho-{uuid.uuid4()}{ext}"
    with open(os.path.join(UPLOAD_DIR, saved_name), "wb") as f:
        f.write(content)

    photos = list(ortho.progress_photos or [])
    photos.append({
        "date": date.today().isoformat(),
        "image_url": f"/uploads/{saved_name}",
        "description": description,
        "visit_number": ortho.visits_completed,
    })
    ortho.progress_photos = photos

    await session.commit()
    await session.refresh(ortho)
    return _ortho_to_dict(ortho)


@router.get("/{ortho_id}/progress")
async def get_ortho_progress(
    ortho_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get progress summary: % complete, months left, payment status."""
    result = await session.execute(
        select(OrthoTreatment).where(
            OrthoTreatment.id == ortho_id,
            OrthoTreatment.clinic_id == current_user.clinic_id,
            OrthoTreatment.is_deleted == False,
        )
    )
    ortho = result.scalar_one_or_none()
    if not ortho:
        return {"error": "Treatment not found"}

    total_planned = ortho.total_visits_planned or 1
    visits_done = ortho.visits_completed or 0
    pct = round(visits_done / total_planned * 100, 1) if total_planned else 0

    months_elapsed = 0
    months_remaining = None
    if ortho.start_date:
        today = date.today()
        months_elapsed = (today.year - ortho.start_date.year) * 12 + (today.month - ortho.start_date.month)
        if ortho.estimated_end_date and ortho.estimated_end_date > today:
            months_remaining = (ortho.estimated_end_date.year - today.year) * 12 + (ortho.estimated_end_date.month - today.month)

    total_cost = ortho.total_cost or 0
    paid = ortho.paid_amount or 0
    remaining_payment = max(total_cost - paid, 0)

    return {
        "id": str(ortho.id),
        "ortho_type": ortho.ortho_type.value if hasattr(ortho.ortho_type, "value") else ortho.ortho_type,
        "visits_completed": visits_done,
        "total_visits_planned": total_planned,
        "progress_percent": pct,
        "months_elapsed": months_elapsed,
        "months_remaining": months_remaining,
        "aligner_progress": f"{ortho.current_aligner or 0}/{ortho.aligner_count or 0}" if ortho.aligner_count else None,
        "total_cost": total_cost,
        "paid_amount": paid,
        "remaining_payment": remaining_payment,
        "payment_percent": round(paid / total_cost * 100, 1) if total_cost else 0,
        "photos_count": len(ortho.progress_photos or []),
        "is_completed": ortho.actual_end_date is not None,
    }
