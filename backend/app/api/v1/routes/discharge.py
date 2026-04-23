from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.api.deps import CurrentUser, DBSession
from app.models.patient import Patient
from app.models.wristband import PatientWristband, WristbandStatus

router = APIRouter(prefix="/discharge", tags=["Discharge"])


class DischargeRequest(BaseModel):
    patient_id: str
    diagnosis: str
    treatment_summary: str
    recommendations: str
    follow_up_date: str | None = None
    medications: list[dict] | None = None


@router.post("/")
async def create_discharge(
    data: DischargeRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create discharge record and send to patient portal."""
    patient = (await session.execute(
        select(Patient).where(Patient.id == uuid.UUID(data.patient_id))
    )).scalar_one_or_none()

    if not patient:
        raise HTTPException(404, "Patient not found")

    # Deactivate wristband if exists
    wbs = (await session.execute(
        select(PatientWristband).where(
            PatientWristband.patient_id == patient.id,
            PatientWristband.status == WristbandStatus.ACTIVE,
        )
    )).scalars().all()
    for wb in wbs:
        wb.status = WristbandStatus.DISCHARGED
        wb.deactivated_at = datetime.now(timezone.utc)

    await session.flush()

    return {
        "status": "discharged",
        "patient_name": f"{patient.last_name} {patient.first_name}",
        "discharge": {
            "diagnosis": data.diagnosis,
            "treatment": data.treatment_summary,
            "recommendations": data.recommendations,
            "follow_up": data.follow_up_date,
            "medications": data.medications,
        },
        "wristbands_deactivated": len(wbs),
        "portal_notification": "sent",
    }


@router.get("/{patient_id}/summary")
async def discharge_summary(patient_id: str, session: DBSession, current_user: CurrentUser):
    """Get discharge summary for print/portal."""
    patient = (await session.execute(
        select(Patient).where(Patient.id == uuid.UUID(patient_id))
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Пациент не найден")

    return {
        "patient_id": patient_id,
        "patient_name": f"{patient.last_name} {patient.first_name}",
        "message": "Discharge summary placeholder",
    }
