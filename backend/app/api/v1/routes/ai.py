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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")


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
