from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.consent import PatientConsent, ConsentStatus, ConsentType
from app.models.patient import Patient

router = APIRouter(prefix="/consents", tags=["Electronic Consent"])


# ---------- schemas ----------

class CreateConsentRequest(BaseModel):
    patient_id: uuid.UUID
    consent_type: ConsentType
    title: str
    body_text: str
    witness_name: str | None = None


class SignConsentRequest(BaseModel):
    signature_data: str  # base64 of drawn signature


# ---------- endpoints ----------

@router.post("/")
async def create_consent(
    data: CreateConsentRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a consent form for patient to sign."""
    patient = (await session.execute(
        select(Patient).where(Patient.id == data.patient_id)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Пациент не найден")

    consent = PatientConsent(
        clinic_id=current_user.clinic_id,
        patient_id=data.patient_id,
        consent_type=data.consent_type,
        title=data.title,
        body_text=data.body_text,
        status=ConsentStatus.PENDING,
        witness_name=data.witness_name,
        created_by_id=current_user.id,
    )
    session.add(consent)
    await session.flush()
    return {"id": str(consent.id), "status": consent.status}


@router.get("/patient/{patient_id}")
async def patient_consents(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    """Get all consents for a patient."""
    rows = (await session.execute(
        select(PatientConsent)
        .where(PatientConsent.patient_id == patient_id, PatientConsent.is_deleted == False)
        .order_by(PatientConsent.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(c.id),
            "consent_type": c.consent_type,
            "title": c.title,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "signed_at": c.signed_at.isoformat() if c.signed_at else None,
        }
        for c in rows
    ]


@router.get("/{consent_id}")
async def get_consent(consent_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    """Get consent detail."""
    consent = (await session.execute(
        select(PatientConsent).where(PatientConsent.id == consent_id)
    )).scalar_one_or_none()
    if not consent:
        raise HTTPException(404, "Согласие не найдено")
    return {
        "id": str(consent.id),
        "patient_id": str(consent.patient_id),
        "consent_type": consent.consent_type,
        "title": consent.title,
        "body_text": consent.body_text,
        "status": consent.status,
        "signed_at": consent.signed_at.isoformat() if consent.signed_at else None,
        "signature_data": consent.signature_data,
        "signed_ip": consent.signed_ip,
        "witness_name": consent.witness_name,
        "created_at": consent.created_at.isoformat() if consent.created_at else None,
    }


@router.post("/{consent_id}/sign")
async def sign_consent(
    consent_id: uuid.UUID,
    data: SignConsentRequest,
    request: Request,
    session: DBSession,
    current_user: CurrentUser,
):
    """Sign a consent form."""
    consent = (await session.execute(
        select(PatientConsent).where(PatientConsent.id == consent_id)
    )).scalar_one_or_none()
    if not consent:
        raise HTTPException(404, "Согласие не найдено")
    if consent.status != ConsentStatus.PENDING:
        raise HTTPException(400, f"Нельзя подписать — текущий статус: {consent.status}")

    consent.status = ConsentStatus.SIGNED
    consent.signed_at = datetime.now(timezone.utc)
    consent.signature_data = data.signature_data
    consent.signed_ip = request.client.host if request.client else None
    await session.flush()
    return {"status": "signed", "signed_at": consent.signed_at.isoformat()}


@router.post("/{consent_id}/decline")
async def decline_consent(consent_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    """Decline a consent form."""
    consent = (await session.execute(
        select(PatientConsent).where(PatientConsent.id == consent_id)
    )).scalar_one_or_none()
    if not consent:
        raise HTTPException(404, "Согласие не найдено")
    if consent.status != ConsentStatus.PENDING:
        raise HTTPException(400, f"Нельзя отклонить — текущий статус: {consent.status}")

    consent.status = ConsentStatus.DECLINED
    await session.flush()
    return {"status": "declined"}


@router.get("/{consent_id}/print", response_class=HTMLResponse)
async def print_consent(consent_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    """Printable HTML version of consent with signature."""
    consent = (await session.execute(
        select(PatientConsent).where(PatientConsent.id == consent_id)
    )).scalar_one_or_none()
    if not consent:
        raise HTTPException(404, "Согласие не найдено")

    patient = (await session.execute(
        select(Patient).where(Patient.id == consent.patient_id)
    )).scalar_one_or_none()
    patient_name = f"{patient.last_name} {patient.first_name}" if patient else "—"

    signature_block = ""
    if consent.signature_data:
        signature_block = f'<img src="{consent.signature_data}" style="max-width:300px;border-bottom:1px solid #000" />'
    else:
        signature_block = '<div style="width:300px;border-bottom:1px solid #000;height:60px"></div>'

    html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<title>{consent.title}</title>
<style>
body {{ font-family: 'Times New Roman', serif; max-width: 700px; margin: 40px auto; line-height: 1.6; }}
h1 {{ text-align: center; font-size: 18px; }}
.meta {{ color: #666; font-size: 13px; margin-bottom: 20px; }}
.body-text {{ white-space: pre-wrap; margin: 20px 0; }}
.signature {{ margin-top: 40px; }}
@media print {{ body {{ margin: 0; }} }}
</style></head><body>
<h1>{consent.title}</h1>
<div class="meta">Пациент: {patient_name} | Тип: {consent.consent_type} | Дата: {consent.created_at.strftime('%d.%m.%Y') if consent.created_at else '—'}</div>
<div class="body-text">{consent.body_text}</div>
<div class="signature">
<p><strong>Подпись пациента:</strong></p>
{signature_block}
<p>Дата подписания: {consent.signed_at.strftime('%d.%m.%Y %H:%M') if consent.signed_at else '________________'}</p>
{f'<p>Свидетель: {consent.witness_name}</p>' if consent.witness_name else ''}
</div></body></html>"""
    return HTMLResponse(content=html)
