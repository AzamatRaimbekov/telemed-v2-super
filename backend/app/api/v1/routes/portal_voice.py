from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.core.database import get_session
from app.api.v1.routes.portal import get_portal_patient
from app.models.patient import Patient
from app.schemas.voice import (
    VoiceProcessRequest,
    VoiceProcessResponse,
    VoiceConfirmRequest,
    VoiceConfirmResponse,
    WhisperResponse,
    VoiceHintsResponse,
    VoiceSettings,
)
from app.services.voice_assistant import VoiceAssistantService
from app.services.voice_assistant.action_executor import execute_confirmed_action

logger = structlog.get_logger()

router = APIRouter(prefix="/portal/voice", tags=["portal-voice"])

PortalPatient = Annotated[Patient, Depends(get_portal_patient)]
DBSession = Annotated[AsyncSession, Depends(get_session)]


@router.post("/process", response_model=VoiceProcessResponse)
async def process_voice(
    data: VoiceProcessRequest,
    patient: PortalPatient,
    session: DBSession,
):
    """Process voice text and return AI response."""
    service = VoiceAssistantService()
    return await service.process(data, patient.id, session)


@router.post("/confirm-action", response_model=VoiceConfirmResponse)
async def confirm_action(
    data: VoiceConfirmRequest,
    patient: PortalPatient,
    session: DBSession,
):
    """Confirm or reject a pending voice action."""
    if not data.confirmed:
        return VoiceConfirmResponse(success=True, message="Действие отменено")

    result = await execute_confirmed_action(data.action_id, patient.id, session)
    return VoiceConfirmResponse(**result)


@router.post("/whisper", response_model=WhisperResponse)
async def whisper_stt(
    patient: PortalPatient,
    audio: UploadFile = File(...),
):
    """Whisper STT fallback — transcribe uploaded audio."""
    try:
        import whisper  # noqa: F401

        # TODO: integrate actual whisper transcription
        return WhisperResponse(text="", language="ru")
    except ImportError:
        return WhisperResponse(text="", language="ru")


@router.get("/hints/{page}", response_model=VoiceHintsResponse)
async def get_hints(
    page: str,
    patient: PortalPatient,
    language: str = "ru",
):
    """Get context hints for a given portal page."""
    hints = VoiceAssistantService.get_hints(page, language)
    return VoiceHintsResponse(hints=hints)


@router.get("/settings", response_model=VoiceSettings)
async def get_voice_settings(patient: PortalPatient):
    """Get patient's voice assistant settings."""
    voice_settings = getattr(patient, "voice_settings", None) or {}
    return VoiceSettings(**voice_settings)


@router.put("/settings", response_model=VoiceSettings)
async def update_voice_settings(
    data: VoiceSettings,
    patient: PortalPatient,
    session: DBSession,
):
    """Update patient's voice assistant settings."""
    patient.voice_settings = data.model_dump()
    session.add(patient)
    await session.flush()
    return data
