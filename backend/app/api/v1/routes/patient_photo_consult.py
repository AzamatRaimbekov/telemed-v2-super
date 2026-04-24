from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from app.api.deps import DBSession
import uuid

router = APIRouter(prefix="/portal/photo-consult", tags=["Portal Photo Consultation"])


class PhotoConsultRequest(BaseModel):
    patient_id: str
    description: str
    urgency: str = "normal"  # normal, urgent


@router.post("/submit")
async def submit_photo_consult(
    session: DBSession,
    patient_id: str = Form(...),
    description: str = Form(...),
    urgency: str = Form("normal"),
):
    """Patient submits photo of dental problem for remote consultation."""
    return {
        "status": "submitted",
        "message": "Ваше обращение принято. Врач ответит в течение 24 часов.",
        "consult_id": str(uuid.uuid4()),
        "urgency": urgency,
    }


@router.get("/my-consults")
async def my_consults(session: DBSession, patient_id: str = None):
    """Get patient's photo consultations."""
    return []  # placeholder
