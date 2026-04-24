from __future__ import annotations

import os
import uuid
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.dental_image import DentalImage, DentalImageType

router = APIRouter(prefix="/dental/images", tags=["Dental Images / Снимки"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")


def _image_to_dict(img: DentalImage) -> dict:
    return {
        "id": str(img.id),
        "patient_id": str(img.patient_id),
        "image_type": img.image_type,
        "tooth_numbers": img.tooth_numbers,
        "image_url": img.image_url,
        "thumbnail_url": img.thumbnail_url,
        "description": img.description,
        "uploaded_by_id": str(img.uploaded_by_id) if img.uploaded_by_id else None,
        "is_before_after": img.is_before_after,
        "pair_image_id": str(img.pair_image_id) if img.pair_image_id else None,
        "created_at": img.created_at.isoformat(),
        "updated_at": img.updated_at.isoformat(),
    }


@router.post("", status_code=201)
async def upload_dental_image(
    session: DBSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    patient_id: uuid.UUID = Form(...),
    image_type: str = Form("photo_intraoral"),
    tooth_numbers: str | None = Form(None),
    description: str | None = Form(None),
    is_before_after: bool = Form(False),
    pair_image_id: uuid.UUID | None = Form(None),
):
    """Upload a dental image (X-ray, photo, etc.)."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = os.path.splitext(file.filename or "file")[1] or ".jpg"
    saved_name = f"dental-{uuid.uuid4()}{ext}"
    with open(os.path.join(UPLOAD_DIR, saved_name), "wb") as f:
        f.write(content)

    img = DentalImage(
        id=uuid.uuid4(),
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        image_type=image_type,
        tooth_numbers=tooth_numbers,
        image_url=f"/uploads/{saved_name}",
        thumbnail_url=None,
        description=description,
        uploaded_by_id=current_user.id,
        is_before_after=is_before_after,
        pair_image_id=pair_image_id,
    )
    session.add(img)
    await session.commit()
    await session.refresh(img)
    return _image_to_dict(img)


@router.get("/patient/{patient_id}")
async def get_patient_images(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    image_type: str | None = None,
):
    """Get all dental images for a patient."""
    q = select(DentalImage).where(
        DentalImage.patient_id == patient_id,
        DentalImage.clinic_id == current_user.clinic_id,
        DentalImage.is_deleted == False,
    )
    if image_type:
        q = q.where(DentalImage.image_type == image_type)
    q = q.order_by(DentalImage.created_at.desc())
    result = await session.execute(q)
    return [_image_to_dict(i) for i in result.scalars().all()]


@router.get("/tooth/{patient_id}/{tooth_number}")
async def get_tooth_images(
    patient_id: uuid.UUID,
    tooth_number: int,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get images for a specific tooth."""
    result = await session.execute(
        select(DentalImage).where(
            DentalImage.patient_id == patient_id,
            DentalImage.clinic_id == current_user.clinic_id,
            DentalImage.is_deleted == False,
            DentalImage.tooth_numbers.ilike(f"%{tooth_number}%"),
        ).order_by(DentalImage.created_at.desc())
    )
    return [_image_to_dict(i) for i in result.scalars().all()]


@router.get("/before-after/{patient_id}")
async def get_before_after_images(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get before/after image pairs for a patient."""
    result = await session.execute(
        select(DentalImage).where(
            DentalImage.patient_id == patient_id,
            DentalImage.clinic_id == current_user.clinic_id,
            DentalImage.is_deleted == False,
            DentalImage.is_before_after == True,
        ).order_by(DentalImage.created_at.desc())
    )
    images = [_image_to_dict(i) for i in result.scalars().all()]
    # Group by pair_image_id
    pairs: dict[str, list] = {}
    standalone: list = []
    for img in images:
        pid = img.get("pair_image_id")
        if pid:
            pairs.setdefault(pid, []).append(img)
        else:
            standalone.append(img)
    return {"pairs": pairs, "standalone": standalone}


@router.get("/{image_id}")
async def get_dental_image(
    image_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get a single dental image detail."""
    result = await session.execute(
        select(DentalImage).where(
            DentalImage.id == image_id,
            DentalImage.clinic_id == current_user.clinic_id,
            DentalImage.is_deleted == False,
        )
    )
    img = result.scalar_one_or_none()
    if not img:
        return {"error": "Image not found"}
    return _image_to_dict(img)


@router.delete("/{image_id}")
async def delete_dental_image(
    image_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a dental image."""
    result = await session.execute(
        select(DentalImage).where(
            DentalImage.id == image_id,
            DentalImage.clinic_id == current_user.clinic_id,
            DentalImage.is_deleted == False,
        )
    )
    img = result.scalar_one_or_none()
    if not img:
        return {"error": "Image not found"}
    img.is_deleted = True
    await session.commit()
    return {"status": "deleted"}
