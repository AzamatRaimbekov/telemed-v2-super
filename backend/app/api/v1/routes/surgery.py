from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select, cast, Date

from app.api.deps import CurrentUser, DBSession
from app.models.surgery_protocol import SurgeryProtocol, SurgeryStatus

router = APIRouter(prefix="/surgery", tags=["Surgery"])


# ---------- schemas ----------

class CreateSurgeryRequest(BaseModel):
    patient_id: uuid.UUID
    surgeon_id: uuid.UUID | None = None
    assistant_ids: list[uuid.UUID] | None = None
    anesthesiologist_id: uuid.UUID | None = None
    surgery_name: str
    surgery_code: str | None = None
    diagnosis: str
    anesthesia_type: str | None = None
    planned_date: datetime | None = None
    room_name: str | None = None
    protocol_text: str | None = None
    postop_instructions: str | None = None


class UpdateSurgeryRequest(BaseModel):
    surgery_name: str | None = None
    surgery_code: str | None = None
    diagnosis: str | None = None
    anesthesia_type: str | None = None
    planned_date: datetime | None = None
    room_name: str | None = None
    protocol_text: str | None = None
    complications: str | None = None
    blood_loss_ml: float | None = None
    implants_used: str | None = None
    postop_instructions: str | None = None
    assistant_ids: list[uuid.UUID] | None = None
    anesthesiologist_id: uuid.UUID | None = None


class CompleteSurgeryRequest(BaseModel):
    protocol_text: str | None = None
    complications: str | None = None
    blood_loss_ml: float | None = None
    implants_used: str | None = None
    postop_instructions: str | None = None


class CancelSurgeryRequest(BaseModel):
    reason: str | None = None


# ---------- helpers ----------

def _surgery_to_dict(s: SurgeryProtocol) -> dict:
    return {
        "id": str(s.id),
        "patient_id": str(s.patient_id),
        "surgeon_id": str(s.surgeon_id),
        "assistant_ids": s.assistant_ids,
        "anesthesiologist_id": str(s.anesthesiologist_id) if s.anesthesiologist_id else None,
        "surgery_name": s.surgery_name,
        "surgery_code": s.surgery_code,
        "diagnosis": s.diagnosis,
        "anesthesia_type": s.anesthesia_type,
        "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        "planned_date": s.planned_date.isoformat() if s.planned_date else None,
        "start_time": s.start_time.isoformat() if s.start_time else None,
        "end_time": s.end_time.isoformat() if s.end_time else None,
        "duration_minutes": s.duration_minutes,
        "room_name": s.room_name,
        "protocol_text": s.protocol_text,
        "complications": s.complications,
        "blood_loss_ml": s.blood_loss_ml,
        "implants_used": s.implants_used,
        "postop_instructions": s.postop_instructions,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/")
async def create_surgery(
    body: CreateSurgeryRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new surgery protocol."""
    protocol = SurgeryProtocol(
        clinic_id=current_user.clinic_id,
        patient_id=body.patient_id,
        surgeon_id=body.surgeon_id or current_user.id,
        assistant_ids=[str(uid) for uid in body.assistant_ids] if body.assistant_ids else None,
        anesthesiologist_id=body.anesthesiologist_id,
        surgery_name=body.surgery_name,
        surgery_code=body.surgery_code,
        diagnosis=body.diagnosis,
        anesthesia_type=body.anesthesia_type,
        status=SurgeryStatus.PLANNED,
        planned_date=body.planned_date,
        room_name=body.room_name,
        protocol_text=body.protocol_text,
        postop_instructions=body.postop_instructions,
    )
    session.add(protocol)
    await session.commit()
    await session.refresh(protocol)
    return _surgery_to_dict(protocol)


@router.get("/")
async def list_surgeries(
    session: DBSession,
    current_user: CurrentUser,
    status: SurgeryStatus | None = None,
    surgeon_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List surgery protocols with filters."""
    q = (
        select(SurgeryProtocol)
        .where(
            SurgeryProtocol.clinic_id == current_user.clinic_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    if status:
        q = q.where(SurgeryProtocol.status == status)
    if surgeon_id:
        q = q.where(SurgeryProtocol.surgeon_id == surgeon_id)
    if date_from:
        q = q.where(cast(SurgeryProtocol.planned_date, Date) >= date_from)
    if date_to:
        q = q.where(cast(SurgeryProtocol.planned_date, Date) <= date_to)

    q = q.order_by(SurgeryProtocol.planned_date.desc().nullslast()).limit(limit).offset(offset)

    result = await session.execute(q)
    return [_surgery_to_dict(s) for s in result.scalars().all()]


@router.get("/schedule")
async def surgery_schedule(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(7, le=30),
):
    """Get upcoming surgeries for the next N days."""
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=days)

    result = await session.execute(
        select(SurgeryProtocol)
        .where(
            SurgeryProtocol.clinic_id == current_user.clinic_id,
            SurgeryProtocol.is_deleted == False,
            SurgeryProtocol.status.in_([SurgeryStatus.PLANNED, SurgeryStatus.IN_PROGRESS]),
            SurgeryProtocol.planned_date >= now,
            SurgeryProtocol.planned_date <= end_date,
        )
        .order_by(SurgeryProtocol.planned_date.asc())
    )
    return [_surgery_to_dict(s) for s in result.scalars().all()]


@router.get("/{surgery_id}")
async def get_surgery(
    surgery_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get surgery protocol detail."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")
    return _surgery_to_dict(protocol)


@router.patch("/{surgery_id}")
async def update_surgery(
    surgery_id: uuid.UUID,
    body: UpdateSurgeryRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a surgery protocol."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")

    update_data = body.model_dump(exclude_unset=True)
    if "assistant_ids" in update_data and update_data["assistant_ids"] is not None:
        update_data["assistant_ids"] = [str(uid) for uid in update_data["assistant_ids"]]
    for key, value in update_data.items():
        setattr(protocol, key, value)

    await session.commit()
    await session.refresh(protocol)
    return _surgery_to_dict(protocol)


@router.patch("/{surgery_id}/start")
async def start_surgery(
    surgery_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark surgery as in progress (set start_time)."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")
    if protocol.status != SurgeryStatus.PLANNED:
        raise HTTPException(status_code=400, detail="Surgery must be in planned status to start")

    protocol.status = SurgeryStatus.IN_PROGRESS
    protocol.start_time = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(protocol)
    return _surgery_to_dict(protocol)


@router.patch("/{surgery_id}/complete")
async def complete_surgery(
    surgery_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    body: CompleteSurgeryRequest | None = None,
):
    """Complete a surgery (set end_time, calculate duration)."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")
    if protocol.status != SurgeryStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Surgery must be in progress to complete")

    now = datetime.now(timezone.utc)
    protocol.status = SurgeryStatus.COMPLETED
    protocol.end_time = now
    if protocol.start_time:
        protocol.duration_minutes = int((now - protocol.start_time).total_seconds() / 60)

    if body:
        if body.protocol_text is not None:
            protocol.protocol_text = body.protocol_text
        if body.complications is not None:
            protocol.complications = body.complications
        if body.blood_loss_ml is not None:
            protocol.blood_loss_ml = body.blood_loss_ml
        if body.implants_used is not None:
            protocol.implants_used = body.implants_used
        if body.postop_instructions is not None:
            protocol.postop_instructions = body.postop_instructions

    await session.commit()
    await session.refresh(protocol)
    return _surgery_to_dict(protocol)


@router.patch("/{surgery_id}/cancel")
async def cancel_surgery(
    surgery_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    body: CancelSurgeryRequest | None = None,
):
    """Cancel a surgery."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")
    if protocol.status in (SurgeryStatus.COMPLETED, SurgeryStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or already cancelled surgery")

    protocol.status = SurgeryStatus.CANCELLED
    if body and body.reason:
        protocol.complications = body.reason
    await session.commit()
    await session.refresh(protocol)
    return _surgery_to_dict(protocol)


@router.get("/{surgery_id}/print")
async def print_surgery_protocol(
    surgery_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get printable HTML surgery protocol."""
    result = await session.execute(
        select(SurgeryProtocol).where(
            SurgeryProtocol.id == surgery_id,
            SurgeryProtocol.is_deleted == False,
        )
    )
    protocol = result.scalar_one_or_none()
    if not protocol:
        raise HTTPException(status_code=404, detail="Surgery protocol not found")

    status_labels = {
        "planned": "Запланирована",
        "in_progress": "В процессе",
        "completed": "Завершена",
        "cancelled": "Отменена",
        "postponed": "Отложена",
    }
    status_text = status_labels.get(
        protocol.status.value if hasattr(protocol.status, "value") else str(protocol.status),
        str(protocol.status),
    )

    planned_str = protocol.planned_date.strftime("%d.%m.%Y %H:%M") if protocol.planned_date else "---"
    start_str = protocol.start_time.strftime("%d.%m.%Y %H:%M") if protocol.start_time else "---"
    end_str = protocol.end_time.strftime("%d.%m.%Y %H:%M") if protocol.end_time else "---"
    duration_str = f"{protocol.duration_minutes} мин" if protocol.duration_minutes else "---"
    blood_str = f"{protocol.blood_loss_ml} мл" if protocol.blood_loss_ml else "---"

    protocol_text_html = ""
    if protocol.protocol_text:
        protocol_text_html = f"""
        <div class="section">
            <h3>Протокол операции</h3>
            <p>{protocol.protocol_text}</p>
        </div>"""

    complications_html = ""
    if protocol.complications:
        complications_html = f"""
        <div class="section">
            <h3>Осложнения</h3>
            <p>{protocol.complications}</p>
        </div>"""

    implants_html = ""
    if protocol.implants_used:
        implants_html = f"""
        <div class="section">
            <h3>Использованные импланты</h3>
            <p>{protocol.implants_used}</p>
        </div>"""

    postop_html = ""
    if protocol.postop_instructions:
        postop_html = f"""
        <div class="section">
            <h3>Послеоперационные назначения</h3>
            <p>{protocol.postop_instructions}</p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Протокол операции</title>
<style>
@page {{ size: A4; margin: 15mm; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 12pt;
    line-height: 1.5;
    padding: 20mm;
    color: #000;
}}
.header {{
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
}}
.header h1 {{
    font-size: 16pt;
    margin-bottom: 5px;
}}
.header h2 {{
    font-size: 13pt;
    font-weight: normal;
}}
.info-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
}}
.info-item {{
    display: flex;
    gap: 8px;
}}
.info-label {{
    font-weight: bold;
    min-width: 180px;
}}
.section {{
    margin-bottom: 15px;
}}
.section h3 {{
    font-size: 13pt;
    border-bottom: 1px solid #666;
    padding-bottom: 3px;
    margin-bottom: 8px;
}}
.footer {{
    margin-top: 40px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}}
.signature-line {{
    border-bottom: 1px solid #000;
    margin-top: 40px;
    padding-bottom: 3px;
}}
@media print {{
    body {{ padding: 0; }}
}}
</style>
</head>
<body>
<div class="header">
    <h1>ПРОТОКОЛ ОПЕРАЦИИ</h1>
    <h2>{protocol.surgery_name}</h2>
</div>

<div class="info-grid">
    <div class="info-item"><span class="info-label">Код операции:</span> {protocol.surgery_code or '---'}</div>
    <div class="info-item"><span class="info-label">Статус:</span> {status_text}</div>
    <div class="info-item"><span class="info-label">Операционная:</span> {protocol.room_name or '---'}</div>
    <div class="info-item"><span class="info-label">Вид анестезии:</span> {protocol.anesthesia_type or '---'}</div>
    <div class="info-item"><span class="info-label">Плановая дата:</span> {planned_str}</div>
    <div class="info-item"><span class="info-label">Начало:</span> {start_str}</div>
    <div class="info-item"><span class="info-label">Окончание:</span> {end_str}</div>
    <div class="info-item"><span class="info-label">Длительность:</span> {duration_str}</div>
    <div class="info-item"><span class="info-label">Кровопотеря:</span> {blood_str}</div>
</div>

<div class="section">
    <h3>Диагноз</h3>
    <p>{protocol.diagnosis}</p>
</div>
{protocol_text_html}
{complications_html}
{implants_html}
{postop_html}

<div class="footer">
    <div>
        <div>Хирург:</div>
        <div class="signature-line"></div>
    </div>
    <div>
        <div>Анестезиолог:</div>
        <div class="signature-line"></div>
    </div>
</div>

<div style="text-align: center; margin-top: 30px; font-size: 9pt; color: #666;">
    MedCore KG | {datetime.now().strftime('%d.%m.%Y %H:%M')}
</div>
</body>
</html>"""

    return HTMLResponse(content=html)
