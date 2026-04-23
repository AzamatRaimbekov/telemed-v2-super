from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, cast, Date

from app.api.deps import CurrentUser, DBSession
from app.models.dicom_study import DicomStudy, StudyStatus, Modality

router = APIRouter(prefix="/dicom", tags=["DICOM"])


# ---------- schemas ----------

class CreateStudyRequest(BaseModel):
    patient_id: uuid.UUID
    referring_doctor_id: uuid.UUID | None = None
    radiologist_id: uuid.UUID | None = None
    study_instance_uid: str
    accession_number: str | None = None
    modality: Modality
    study_description: str | None = None
    body_part: str | None = None
    study_date: datetime | None = None
    series_count: int = 1
    image_count: int = 1
    storage_path: str | None = None
    thumbnail_url: str | None = None
    metadata_json: dict | None = None


class UpdateReportRequest(BaseModel):
    radiologist_id: uuid.UUID | None = None
    report_text: str | None = None
    report_conclusion: str | None = None
    status: StudyStatus | None = None


# ---------- helpers ----------

def _study_to_dict(s: DicomStudy) -> dict:
    return {
        "id": str(s.id),
        "patient_id": str(s.patient_id),
        "referring_doctor_id": str(s.referring_doctor_id) if s.referring_doctor_id else None,
        "radiologist_id": str(s.radiologist_id) if s.radiologist_id else None,
        "study_instance_uid": s.study_instance_uid,
        "accession_number": s.accession_number,
        "modality": s.modality.value if hasattr(s.modality, "value") else str(s.modality),
        "study_description": s.study_description,
        "body_part": s.body_part,
        "study_date": s.study_date.isoformat() if s.study_date else None,
        "series_count": s.series_count,
        "image_count": s.image_count,
        "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        "storage_path": s.storage_path,
        "thumbnail_url": s.thumbnail_url,
        "report_text": s.report_text,
        "report_conclusion": s.report_conclusion,
        "metadata_json": s.metadata_json,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/studies")
async def create_study(
    body: CreateStudyRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Upload/register a new DICOM study."""
    study = DicomStudy(
        clinic_id=current_user.clinic_id,
        patient_id=body.patient_id,
        referring_doctor_id=body.referring_doctor_id or current_user.id,
        radiologist_id=body.radiologist_id,
        study_instance_uid=body.study_instance_uid,
        accession_number=body.accession_number,
        modality=body.modality,
        study_description=body.study_description,
        body_part=body.body_part,
        study_date=body.study_date,
        series_count=body.series_count,
        image_count=body.image_count,
        storage_path=body.storage_path,
        thumbnail_url=body.thumbnail_url,
        metadata_json=body.metadata_json,
        status=StudyStatus.UPLOADED,
    )
    session.add(study)
    await session.commit()
    await session.refresh(study)
    return _study_to_dict(study)


@router.get("/studies")
async def list_studies(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    modality: Modality | None = None,
    status: StudyStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List DICOM studies with filters."""
    q = (
        select(DicomStudy)
        .where(
            DicomStudy.clinic_id == current_user.clinic_id,
            DicomStudy.is_deleted == False,
        )
    )
    if patient_id:
        q = q.where(DicomStudy.patient_id == patient_id)
    if modality:
        q = q.where(DicomStudy.modality == modality)
    if status:
        q = q.where(DicomStudy.status == status)
    if date_from:
        q = q.where(cast(DicomStudy.study_date, Date) >= date_from)
    if date_to:
        q = q.where(cast(DicomStudy.study_date, Date) <= date_to)

    q = q.order_by(DicomStudy.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(q)
    return [_study_to_dict(s) for s in result.scalars().all()]


@router.get("/modalities")
async def get_modalities():
    """Return available DICOM modalities."""
    return [
        {"value": m.value, "label": m.name}
        for m in Modality
    ]


@router.get("/studies/{study_id}")
async def get_study(
    study_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get DICOM study detail with report."""
    result = await session.execute(
        select(DicomStudy).where(
            DicomStudy.id == study_id,
            DicomStudy.is_deleted == False,
        )
    )
    study = result.scalar_one_or_none()
    if not study:
        raise HTTPException(status_code=404, detail="DICOM study not found")
    return _study_to_dict(study)


@router.patch("/studies/{study_id}/report")
async def update_report(
    study_id: uuid.UUID,
    body: UpdateReportRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Add or update radiologist report for a study."""
    result = await session.execute(
        select(DicomStudy).where(
            DicomStudy.id == study_id,
            DicomStudy.is_deleted == False,
        )
    )
    study = result.scalar_one_or_none()
    if not study:
        raise HTTPException(status_code=404, detail="DICOM study not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(study, key, value)

    if body.report_text is not None and study.status == StudyStatus.UPLOADED:
        study.status = StudyStatus.READY

    await session.commit()
    await session.refresh(study)
    return _study_to_dict(study)


@router.get("/patient/{patient_id}")
async def get_patient_studies(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """Get all DICOM studies for a specific patient."""
    q = (
        select(DicomStudy)
        .where(
            DicomStudy.clinic_id == current_user.clinic_id,
            DicomStudy.patient_id == patient_id,
            DicomStudy.is_deleted == False,
        )
        .order_by(DicomStudy.study_date.desc().nullslast())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(q)
    return [_study_to_dict(s) for s in result.scalars().all()]
