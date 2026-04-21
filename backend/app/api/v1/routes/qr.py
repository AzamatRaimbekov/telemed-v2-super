from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.patient import Patient
from app.services.qr_generator import generate_patient_qr

router = APIRouter(prefix="/qr", tags=["QR"])


@router.get("/patients/{patient_id}/qr")
async def get_patient_qr(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Generate and return QR code image for a patient."""
    result = await session.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    full_name = f"{patient.last_name} {patient.first_name}"
    buffer = generate_patient_qr(patient.id, full_name)

    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=qr-patient-{patient_id}.png"},
    )


@router.get("/scan/{patient_id}")
async def scan_qr_resolve(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Resolve a scanned QR code to patient data."""
    result = await session.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "id": patient.id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "middle_name": patient.middle_name,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
        "phone": patient.phone,
        "inn": patient.inn,
    }
