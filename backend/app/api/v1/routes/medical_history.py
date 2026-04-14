from __future__ import annotations
import uuid
from fastapi import APIRouter, Query
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.medical_history import MedicalHistoryCreate, MedicalHistoryUpdate
from app.services.medical_history import MedicalHistoryService

router = APIRouter(prefix="/patients", tags=["Medical History"])


@router.get("/{patient_id}/history")
async def list_history_entries(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    entry_type: str | None = None,
    period: str | None = None,
    author_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    service = MedicalHistoryService(session)
    entries, total = await service.list_entries(
        patient_id, current_user.clinic_id, entry_type, period, author_id, skip, limit
    )
    return {
        "items": [
            {
                "id": e.id,
                "patient_id": e.patient_id,
                "hospitalization_id": e.hospitalization_id,
                "entry_type": e.entry_type.value if hasattr(e.entry_type, "value") else str(e.entry_type),
                "title": e.title,
                "recorded_at": e.recorded_at,
                "author_id": e.author_id,
                "is_verified": e.is_verified,
                "source_type": e.source_type.value if e.source_type and hasattr(e.source_type, "value") else e.source_type,
                "source_document_url": e.source_document_url,
                "ai_confidence": float(e.ai_confidence) if e.ai_confidence is not None else None,
                "content": e.content,
                "linked_diagnosis_id": e.linked_diagnosis_id,
                "linked_lab_id": e.linked_lab_id,
                "linked_procedure_id": e.linked_procedure_id,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
                "author": {
                    "id": e.author.id,
                    "first_name": e.author.first_name,
                    "last_name": e.author.last_name,
                } if e.author else None,
            }
            for e in entries
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{patient_id}/history/stats")
async def get_history_stats(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = MedicalHistoryService(session)
    stats = await service.get_stats(patient_id, current_user.clinic_id)
    return {"patient_id": patient_id, "stats": stats}


@router.get("/{patient_id}/history/{entry_id}")
async def get_history_entry(
    patient_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = MedicalHistoryService(session)
    e = await service.get_entry(entry_id, current_user.clinic_id)
    return {
        "id": e.id,
        "patient_id": e.patient_id,
        "hospitalization_id": e.hospitalization_id,
        "entry_type": e.entry_type.value if hasattr(e.entry_type, "value") else str(e.entry_type),
        "title": e.title,
        "recorded_at": e.recorded_at,
        "author_id": e.author_id,
        "is_verified": e.is_verified,
        "source_type": e.source_type.value if e.source_type and hasattr(e.source_type, "value") else e.source_type,
        "source_document_url": e.source_document_url,
        "ai_confidence": float(e.ai_confidence) if e.ai_confidence is not None else None,
        "content": e.content,
        "linked_diagnosis_id": e.linked_diagnosis_id,
        "linked_lab_id": e.linked_lab_id,
        "linked_procedure_id": e.linked_procedure_id,
        "created_at": e.created_at,
        "updated_at": e.updated_at,
        "author": {
            "id": e.author.id,
            "first_name": e.author.first_name,
            "last_name": e.author.last_name,
        } if e.author else None,
    }


@router.post("/{patient_id}/history", status_code=201)
async def create_history_entry(
    patient_id: uuid.UUID,
    data: MedicalHistoryCreate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
):
    service = MedicalHistoryService(session)
    entry_data = data.model_dump(exclude_unset=True)
    entry_data["patient_id"] = patient_id
    e = await service.create_entry(entry_data, current_user.id, current_user.clinic_id)
    await session.commit()
    return {"id": e.id, "status": "created"}


@router.patch("/{patient_id}/history/{entry_id}")
async def update_history_entry(
    patient_id: uuid.UUID,
    entry_id: uuid.UUID,
    data: MedicalHistoryUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
):
    service = MedicalHistoryService(session)
    e = await service.update_entry(entry_id, data.model_dump(exclude_unset=True), current_user.clinic_id)
    return {"id": e.id, "status": "updated"}


@router.delete("/{patient_id}/history/{entry_id}", status_code=204)
async def delete_history_entry(
    patient_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    service = MedicalHistoryService(session)
    await service.delete_entry(entry_id, current_user.clinic_id)


@router.post("/{patient_id}/history/{entry_id}/verify")
async def verify_history_entry(
    patient_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _doctor=require_role(UserRole.DOCTOR),
):
    service = MedicalHistoryService(session)
    e = await service.verify_entry(entry_id, current_user.clinic_id)
    return {"id": e.id, "is_verified": e.is_verified, "status": "verified"}
