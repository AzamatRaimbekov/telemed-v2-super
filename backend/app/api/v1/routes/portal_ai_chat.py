from __future__ import annotations
import uuid
import httpx
import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_session
from app.models.patient import Patient
from app.models.diagnosis import Diagnosis
from app.models.medication import Prescription, PrescriptionItem, Drug
from app.models.laboratory import LabOrder, LabResult
from app.api.v1.routes.portal import get_portal_patient
from typing import Annotated

logger = structlog.get_logger()

router = APIRouter(prefix="/portal/ai-chat", tags=["Portal — AI Chat"])

DBSession = Annotated[AsyncSession, Depends(get_session)]
PortalPatient = Annotated[Patient, Depends(get_portal_patient)]

SYSTEM_PROMPT = (
    "You are a medical information assistant for MedCore KG. "
    "You explain lab results and medical terms in simple language. "
    "You do NOT diagnose or prescribe. Always recommend consulting with a doctor. "
    "Answer in the same language the patient uses (Russian or Kyrgyz by default). "
    "Be concise and empathetic."
)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str


async def _build_patient_context(patient_id: uuid.UUID, session: AsyncSession) -> str:
    """Gather patient diagnoses, recent labs, and medications for AI context."""
    parts: list[str] = []

    # Diagnoses
    q = select(Diagnosis).where(
        Diagnosis.patient_id == patient_id, Diagnosis.is_deleted == False
    ).limit(10)
    result = await session.execute(q)
    diagnoses = result.scalars().all()
    if diagnoses:
        diag_lines = [f"- {d.title} ({d.icd_code})" for d in diagnoses]
        parts.append("Diagnoses:\n" + "\n".join(diag_lines))

    # Recent lab results
    from app.models.laboratory import LabTestCatalog
    q = (
        select(LabResult, LabOrder, LabTestCatalog)
        .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
        .join(LabTestCatalog, LabOrder.test_id == LabTestCatalog.id)
        .where(LabOrder.patient_id == patient_id, LabOrder.is_deleted == False)
        .order_by(LabResult.created_at.desc())
        .limit(15)
    )
    result = await session.execute(q)
    labs = result.all()
    if labs:
        lab_lines = [f"- {cat.name}: {lr.value} {lr.unit or ''} (ref: {lr.reference_range or 'N/A'})" for lr, _order, cat in labs]
        parts.append("Recent lab results:\n" + "\n".join(lab_lines))

    # Medications (prescriptions)
    q = (
        select(PrescriptionItem, Drug)
        .join(Prescription, PrescriptionItem.prescription_id == Prescription.id)
        .join(Drug, PrescriptionItem.drug_id == Drug.id)
        .where(Prescription.patient_id == patient_id, Prescription.is_deleted == False)
        .order_by(Prescription.created_at.desc())
        .limit(10)
    )
    result = await session.execute(q)
    meds = result.all()
    if meds:
        med_lines = [f"- {drug.name}: {item.dosage}, {item.frequency}" for item, drug in meds]
        parts.append("Current medications:\n" + "\n".join(med_lines))

    if not parts:
        return "No medical data available for this patient yet."
    return "\n\n".join(parts)


async def _call_gemini(user_message: str, system_prompt: str) -> str | None:
    """Call Gemini API. Returns answer text or None on failure."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_message}]}],
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                GEMINI_API_URL, params={"key": api_key}, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
        return data["candidates"][0]["content"]["parts"][0].get("text", "")
    except Exception as e:
        logger.warning("portal_ai_gemini_error", error=str(e))
        return None


async def _call_deepseek(user_message: str, system_prompt: str) -> str | None:
    """Call DeepSeek API. Returns answer text or None on failure."""
    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        return None
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 500,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                DEEPSEEK_API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"].get("content", "")
    except Exception as e:
        logger.warning("portal_ai_deepseek_error", error=str(e))
        return None


@router.post("", response_model=ChatResponse)
async def ai_chat(data: ChatRequest, patient: PortalPatient, session: DBSession):
    """Patient asks a question about their health data, AI answers."""
    patient_context = await _build_patient_context(patient.id, session)
    full_prompt = f"{SYSTEM_PROMPT}\n\nPatient medical context:\n{patient_context}"

    # Try Gemini first, fall back to DeepSeek
    answer = await _call_gemini(data.message, full_prompt)
    if not answer:
        answer = await _call_deepseek(data.message, full_prompt)
    if not answer:
        answer = (
            "Извините, сервис временно недоступен. "
            "Пожалуйста, обратитесь к вашему лечащему врачу."
        )

    return ChatResponse(answer=answer)
