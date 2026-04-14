from __future__ import annotations
import uuid
from fastapi import APIRouter
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.diagnosis import DiagnosisCreate, DiagnosisUpdate
from app.services.diagnosis import DiagnosisService

router = APIRouter(prefix="/patients", tags=["Diagnoses"])


def _to_dict(d) -> dict:
    doctor_name = ""
    if d.diagnosed_by:
        doctor_name = f"{d.diagnosed_by.last_name} {d.diagnosed_by.first_name}"
    visit_info = None
    if d.visit:
        visit_info = {
            "id": d.visit.id,
            "visit_type": d.visit.visit_type.value if hasattr(d.visit.visit_type, "value") else str(d.visit.visit_type),
            "chief_complaint": d.visit.chief_complaint,
            "started_at": d.visit.started_at,
        }
    return {
        "id": d.id,
        "patient_id": d.patient_id,
        "icd_code": d.icd_code,
        "title": d.title,
        "description": d.description,
        "status": d.status.value if hasattr(d.status, "value") else str(d.status),
        "diagnosed_at": d.diagnosed_at,
        "resolved_at": d.resolved_at,
        "diagnosed_by_id": d.diagnosed_by_id,
        "diagnosed_by_name": doctor_name,
        "visit": visit_info,
        "notes": d.notes,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


@router.get("/{patient_id}/diagnoses-list")
async def list_diagnoses(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = None,
):
    svc = DiagnosisService(session)
    items = await svc.list_diagnoses(patient_id, current_user.clinic_id, status)
    return [_to_dict(d) for d in items]


@router.get("/{patient_id}/diagnoses-list/{diagnosis_id}")
async def get_diagnosis(
    patient_id: uuid.UUID,
    diagnosis_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    svc = DiagnosisService(session)
    d = await svc.get_diagnosis(diagnosis_id, current_user.clinic_id)
    return _to_dict(d)


@router.post("/{patient_id}/diagnoses-list", status_code=201)
async def create_diagnosis(
    patient_id: uuid.UUID,
    data: DiagnosisCreate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    svc = DiagnosisService(session)
    entry_data = data.model_dump(exclude_unset=True)
    entry_data["patient_id"] = patient_id
    d = await svc.create_diagnosis(entry_data, current_user.id, current_user.clinic_id)
    await session.commit()
    return _to_dict(d)


@router.patch("/{patient_id}/diagnoses-list/{diagnosis_id}")
async def update_diagnosis(
    patient_id: uuid.UUID,
    diagnosis_id: uuid.UUID,
    data: DiagnosisUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    svc = DiagnosisService(session)
    d = await svc.update_diagnosis(diagnosis_id, data.model_dump(exclude_unset=True), current_user.clinic_id)
    await session.commit()
    return _to_dict(d)


@router.delete("/{patient_id}/diagnoses-list/{diagnosis_id}", status_code=204)
async def delete_diagnosis(
    patient_id: uuid.UUID,
    diagnosis_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    svc = DiagnosisService(session)
    await svc.delete_diagnosis(diagnosis_id, current_user.clinic_id)
    await session.commit()
