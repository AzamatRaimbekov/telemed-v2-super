from __future__ import annotations
import uuid
import os
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.models.visit_summary import VisitSummary, SummaryStatus
from app.services.ai_summarizer import summarize_transcript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/visit-summaries", tags=["Visit Summaries"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")


# ── Pydantic schemas ──────────────────────────────────────────────

class CreateSummaryRequest(BaseModel):
    patient_id: uuid.UUID
    visit_id: Optional[uuid.UUID] = None
    transcript: str


class PatchSummaryRequest(BaseModel):
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    examination: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    recommendations: Optional[str] = None
    follow_up: Optional[str] = None


class SummaryResponse(BaseModel):
    id: uuid.UUID
    visit_id: Optional[uuid.UUID]
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    clinic_id: uuid.UUID
    audio_url: Optional[str]
    transcript: Optional[str]
    structured_summary: Optional[dict]
    ai_model_used: Optional[str]
    status: str
    approved_by_id: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────

def _summary_to_dict(s: VisitSummary) -> dict:
    return {
        "id": str(s.id),
        "visit_id": str(s.visit_id) if s.visit_id else None,
        "patient_id": str(s.patient_id),
        "doctor_id": str(s.doctor_id),
        "clinic_id": str(s.clinic_id),
        "audio_url": s.audio_url,
        "transcript": s.transcript,
        "structured_summary": s.structured_summary,
        "ai_model_used": s.ai_model_used,
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "approved_by_id": str(s.approved_by_id) if s.approved_by_id else None,
        "approved_at": s.approved_at.isoformat() if s.approved_at else None,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/")
async def create_summary_from_transcript(
    body: CreateSummaryRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Create a visit summary from a text transcript."""
    summary = VisitSummary(
        patient_id=body.patient_id,
        visit_id=body.visit_id,
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
        transcript=body.transcript,
        status=SummaryStatus.PROCESSING,
    )
    session.add(summary)
    await session.flush()

    try:
        structured, model_name = await summarize_transcript(body.transcript)
        summary.structured_summary = structured
        summary.ai_model_used = model_name
        summary.status = SummaryStatus.DRAFT
    except Exception as e:
        logger.exception("AI summarization failed")
        summary.status = SummaryStatus.DRAFT
        summary.ai_model_used = "error"
        summary.structured_summary = {"error": str(e), "raw_transcript": body.transcript}

    await session.commit()
    await session.refresh(summary)
    return _summary_to_dict(summary)


@router.post("/audio")
async def create_summary_from_audio(
    file: UploadFile = File(...),
    patient_id: uuid.UUID = Form(...),
    visit_id: Optional[uuid.UUID] = Form(None),
    transcript: Optional[str] = Form(None),
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Create a visit summary from audio upload. If transcript is provided alongside, use it directly."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 50MB)")

    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    saved_filename = f"visit-audio-{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    audio_url = f"/uploads/{saved_filename}"

    if not transcript:
        raise HTTPException(
            status_code=501,
            detail="Audio transcription requires Whisper model. Please provide transcript text alongside the audio, or use the /ai/transcribe endpoint first.",
        )

    summary = VisitSummary(
        patient_id=patient_id,
        visit_id=visit_id,
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
        audio_url=audio_url,
        transcript=transcript,
        status=SummaryStatus.PROCESSING,
    )
    session.add(summary)
    await session.flush()

    try:
        structured, model_name = await summarize_transcript(transcript)
        summary.structured_summary = structured
        summary.ai_model_used = model_name
        summary.status = SummaryStatus.DRAFT
    except Exception as e:
        logger.exception("AI summarization failed")
        summary.status = SummaryStatus.DRAFT
        summary.ai_model_used = "error"
        summary.structured_summary = {"error": str(e), "raw_transcript": transcript}

    await session.commit()
    await session.refresh(summary)
    return _summary_to_dict(summary)


@router.get("/")
async def list_summaries(
    patient_id: Optional[uuid.UUID] = None,
    doctor_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """List visit summaries with optional filters."""
    query = select(VisitSummary).where(
        VisitSummary.clinic_id == current_user.clinic_id,
        VisitSummary.is_deleted == False,
    )
    if patient_id:
        query = query.where(VisitSummary.patient_id == patient_id)
    if doctor_id:
        query = query.where(VisitSummary.doctor_id == doctor_id)
    if status:
        query = query.where(VisitSummary.status == status)

    query = query.order_by(VisitSummary.created_at.desc())
    result = await session.execute(query)
    summaries = result.scalars().all()
    return [_summary_to_dict(s) for s in summaries]


@router.get("/{summary_id}")
async def get_summary(
    summary_id: uuid.UUID,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Get a single visit summary by ID."""
    result = await session.execute(
        select(VisitSummary).where(
            VisitSummary.id == summary_id,
            VisitSummary.clinic_id == current_user.clinic_id,
            VisitSummary.is_deleted == False,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Visit summary not found")
    return _summary_to_dict(summary)


@router.patch("/{summary_id}/approve")
async def approve_summary(
    summary_id: uuid.UUID,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Doctor approves an AI-generated summary."""
    result = await session.execute(
        select(VisitSummary).where(
            VisitSummary.id == summary_id,
            VisitSummary.clinic_id == current_user.clinic_id,
            VisitSummary.is_deleted == False,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Visit summary not found")

    summary.status = SummaryStatus.APPROVED
    summary.approved_by_id = current_user.id
    summary.approved_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(summary)
    return _summary_to_dict(summary)


@router.patch("/{summary_id}/reject")
async def reject_summary(
    summary_id: uuid.UUID,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Doctor rejects an AI-generated summary."""
    result = await session.execute(
        select(VisitSummary).where(
            VisitSummary.id == summary_id,
            VisitSummary.clinic_id == current_user.clinic_id,
            VisitSummary.is_deleted == False,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Visit summary not found")

    summary.status = SummaryStatus.REJECTED
    await session.commit()
    await session.refresh(summary)
    return _summary_to_dict(summary)


@router.patch("/{summary_id}")
async def edit_summary(
    summary_id: uuid.UUID,
    body: PatchSummaryRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Edit structured_summary fields of a visit summary."""
    result = await session.execute(
        select(VisitSummary).where(
            VisitSummary.id == summary_id,
            VisitSummary.clinic_id == current_user.clinic_id,
            VisitSummary.is_deleted == False,
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Visit summary not found")

    current_data = summary.structured_summary or {}
    updates = body.model_dump(exclude_unset=True)
    current_data.update(updates)
    summary.structured_summary = current_data

    await session.commit()
    await session.refresh(summary)
    return _summary_to_dict(summary)
