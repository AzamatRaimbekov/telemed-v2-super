from fastapi import APIRouter, HTTPException
from sqlalchemy import select, and_
from app.core.database import async_session_factory
from app.models.patient import Patient
from app.models.wristband import PatientWristband, WristbandStatus

router = APIRouter(prefix="/bedside", tags=["Bedside Dashboard"])


@router.get("/{wristband_uid}")
async def bedside_dashboard(wristband_uid: str):
    """Public endpoint for bedside tablet — shows patient schedule and info."""
    async with async_session_factory() as db:
        wb = (await db.execute(select(PatientWristband).where(and_(
            PatientWristband.wristband_uid == wristband_uid.upper(),
            PatientWristband.status == WristbandStatus.ACTIVE,
        )))).scalar_one_or_none()

        if not wb:
            raise HTTPException(404, "Браслет не найден")

        patient = (await db.execute(select(Patient).where(Patient.id == wb.patient_id))).scalar_one_or_none()
        if not patient:
            raise HTTPException(404, "Пациент не найден")

        return {
            "patient": {
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "wristband_uid": wb.wristband_uid,
            },
            "today_schedule": [
                {"time": "08:00", "type": "medication", "description": "Приём лекарств"},
                {"time": "09:00", "type": "procedure", "description": "Измерение давления"},
                {"time": "10:00", "type": "doctor_visit", "description": "Обход врача"},
                {"time": "12:00", "type": "meal", "description": "Обед"},
                {"time": "14:00", "type": "medication", "description": "Приём лекарств"},
                {"time": "16:00", "type": "procedure", "description": "Капельница"},
            ],
            "nurse_call_available": True,
            "message_from_doctor": None,
        }
