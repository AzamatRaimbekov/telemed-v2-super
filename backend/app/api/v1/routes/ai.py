from __future__ import annotations
import uuid
import os
import tempfile
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.core.config import settings
from app.schemas.ai import (
    DiagnosisSuggestRequest,
    ExamGenerateRequest,
    PatientSummaryRequest,
    ConclusionGenerateRequest,
)
from app.services.ai.gateway import AIGateway
from app.models.ai import AIUsageLog, AIGeneratedContent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")

_gateway: AIGateway | None = None

def get_gateway() -> AIGateway:
    global _gateway
    if _gateway is None:
        _gateway = AIGateway()
    return _gateway


@router.post("/analyze-medical-document")
async def analyze_medical_document(
    file: UploadFile = File(...),
    patient_id: uuid.UUID = Form(...),
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.CLINIC_ADMIN),
):
    # TODO: Integrate Claude Vision API for real document analysis.
    # Currently returns a mock response structure matching the expected format.

    # Ensure uploads directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Save the uploaded file
    file_ext = os.path.splitext(file.filename or "document")[1] or ".bin"
    saved_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/{saved_filename}"

    return {
        "document_url": file_url,
        "entry_type": "ai_generated",
        "extracted_data": {
            "document_type": {"value": "discharge_summary", "confidence": 0.9},
            "document_date": {"value": None, "confidence": 0.0},
            "facility": {"value": None, "confidence": 0.0},
            "doctor": {"value": None, "confidence": 0.0},
            "diagnoses": [],
            "medications": [],
            "lab_values": [],
            "recommendations": {"value": None, "confidence": 0.0},
            "raw_text": "Document analysis placeholder - integrate Claude API for production",
            "notes": "Mock analysis - real AI integration pending",
        },
        "overall_confidence": 0.0,
        "ai_notes": "This is a placeholder response. Integrate Claude Vision API for real document analysis.",
        "suggested_title": "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u044b\u0439 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442",
    }


@router.post("/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
):
    """Upload an audio recording and return its URL."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 50MB)")

    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    saved_filename = f"audio-{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    return {"url": f"/uploads/{saved_filename}", "filename": saved_filename, "size": len(audio_bytes)}


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("ru"),
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    """Transcribe audio file using OpenAI Whisper API."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    allowed_types = [
        "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
        "audio/wav", "audio/x-wav", "audio/mp3", "video/webm",
    ]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {file.content_type}")

    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file is too small or empty")
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"

    try:
        import httpx

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(tmp_path, "rb") as audio_file:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    files={"file": (f"audio{ext}", audio_file, file.content_type or "audio/webm")},
                    data={"model": "whisper-1", "language": language, "response_format": "json"},
                )

        os.unlink(tmp_path)

        if response.status_code != 200:
            logger.error("Whisper API error %s: %s", response.status_code, response.text)
            raise HTTPException(status_code=502, detail="Whisper API error")

        result = response.json()
        return {"text": result.get("text", ""), "language": language}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Whisper API timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/diagnosis/suggest")
async def suggest_diagnoses(
    body: DiagnosisSuggestRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.suggest_diagnoses(
            symptoms=body.symptoms,
            age=body.age,
            sex=body.sex,
            existing_diagnoses=body.existing_diagnoses,
        )
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="diagnosis",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="diagnosis",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI diagnosis suggest failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/exam/generate")
async def generate_exam(
    body: ExamGenerateRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.generate_exam(
            complaints=body.complaints,
            visit_type=body.visit_type,
        )
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="exam",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="exam",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI exam generate failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/summary/patient")
async def summarize_patient(
    body: PatientSummaryRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN, UserRole.NURSE),
):
    try:
        from sqlalchemy import select
        from app.models.medical import Visit
        from app.models.diagnosis import Diagnosis

        visits_q = await session.execute(
            select(Visit).where(Visit.patient_id == body.patient_id).order_by(Visit.created_at.desc()).limit(20)
        )
        visits = visits_q.scalars().all()

        diagnoses_q = await session.execute(
            select(Diagnosis).where(Diagnosis.patient_id == body.patient_id, Diagnosis.is_deleted == False)
        )
        diagnoses = diagnoses_q.scalars().all()

        history_parts = []
        for v in visits:
            history_parts.append(f"Визит ({v.visit_type.value}): жалобы={v.chief_complaint or 'н/д'}, осмотр={v.examination_notes or 'н/д'}, диагноз={v.diagnosis_text or 'н/д'}")
        for d in diagnoses:
            history_parts.append(f"Диагноз: {d.icd_code} {d.title} (статус: {d.status.value})")

        history_text = "\n".join(history_parts) if history_parts else "История болезни пуста."

        gateway = get_gateway()
        result = await gateway.summarize_patient(history_text=history_text)

        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="summary",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="summary",
            input_data={"patient_id": str(body.patient_id)},
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI patient summary failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/conclusion/generate")
async def generate_conclusion(
    body: ConclusionGenerateRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.generate_conclusion(
            diagnoses=body.diagnoses,
            exam_notes=body.exam_notes,
            treatment=body.treatment,
        )
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="conclusion",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="conclusion",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI conclusion generate failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
