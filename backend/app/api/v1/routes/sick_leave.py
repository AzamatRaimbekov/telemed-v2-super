from __future__ import annotations

import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select, and_

from app.api.deps import CurrentUser, DBSession
from app.models.sick_leave import SickLeave, SickLeaveStatus
from app.models.patient import Patient
from app.models.user import User

router = APIRouter(prefix="/sick-leave", tags=["Sick Leave (Больничный лист)"])


# ---------- schemas ----------

class CreateSickLeaveRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str | None = None
    diagnosis_name: str | None = None
    start_date: date
    end_date: date
    employer_name: str | None = None
    notes: str | None = None


class ExtendSickLeaveRequest(BaseModel):
    additional_days: int


# ---------- helpers ----------

def _generate_number() -> str:
    """Generate unique sick leave number."""
    now = datetime.now(timezone.utc)
    return f"BL-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"


def _sick_leave_to_dict(sl: SickLeave) -> dict:
    return {
        "id": str(sl.id),
        "patient_id": str(sl.patient_id),
        "doctor_id": str(sl.doctor_id),
        "number": sl.number,
        "diagnosis_code": sl.diagnosis_code,
        "diagnosis_name": sl.diagnosis_name,
        "start_date": sl.start_date.isoformat() if sl.start_date else None,
        "end_date": sl.end_date.isoformat() if sl.end_date else None,
        "extension_days": sl.extension_days,
        "status": sl.status,
        "employer_name": sl.employer_name,
        "notes": sl.notes,
        "created_at": sl.created_at.isoformat() if sl.created_at else None,
    }


# ---------- endpoints ----------

@router.post("/")
async def create_sick_leave(
    data: CreateSickLeaveRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Issue a new sick leave (больничный лист)."""
    if data.end_date < data.start_date:
        raise HTTPException(400, "Дата окончания раньше даты начала")

    patient = (await session.execute(
        select(Patient).where(Patient.id == data.patient_id)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Пациент не найден")

    sl = SickLeave(
        clinic_id=current_user.clinic_id,
        patient_id=data.patient_id,
        doctor_id=current_user.id,
        number=_generate_number(),
        diagnosis_code=data.diagnosis_code,
        diagnosis_name=data.diagnosis_name,
        start_date=data.start_date,
        end_date=data.end_date,
        status=SickLeaveStatus.ISSUED,
        employer_name=data.employer_name,
        notes=data.notes,
    )
    session.add(sl)
    await session.flush()
    return _sick_leave_to_dict(sl)


@router.get("/")
async def list_sick_leaves(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    doctor_id: uuid.UUID | None = None,
    status: SickLeaveStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """List sick leaves with filters."""
    q = select(SickLeave).where(
        SickLeave.clinic_id == current_user.clinic_id,
        SickLeave.is_deleted == False,
    )
    if patient_id:
        q = q.where(SickLeave.patient_id == patient_id)
    if doctor_id:
        q = q.where(SickLeave.doctor_id == doctor_id)
    if status:
        q = q.where(SickLeave.status == status)
    if date_from:
        q = q.where(SickLeave.start_date >= date_from)
    if date_to:
        q = q.where(SickLeave.end_date <= date_to)

    q = q.order_by(SickLeave.created_at.desc())
    rows = (await session.execute(q)).scalars().all()
    return [_sick_leave_to_dict(sl) for sl in rows]


@router.get("/verify/{number}")
async def verify_sick_leave(number: str, session: DBSession):
    """Verify sick leave by number (public endpoint)."""
    sl = (await session.execute(
        select(SickLeave).where(SickLeave.number == number, SickLeave.is_deleted == False)
    )).scalar_one_or_none()
    if not sl:
        raise HTTPException(404, "Больничный лист не найден")
    return {
        "number": sl.number,
        "status": sl.status,
        "start_date": sl.start_date.isoformat() if sl.start_date else None,
        "end_date": sl.end_date.isoformat() if sl.end_date else None,
        "extension_days": sl.extension_days,
        "valid": sl.status in (SickLeaveStatus.ISSUED, SickLeaveStatus.EXTENDED),
    }


@router.get("/{sick_leave_id}")
async def get_sick_leave(
    sick_leave_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get sick leave detail."""
    sl = (await session.execute(
        select(SickLeave).where(SickLeave.id == sick_leave_id)
    )).scalar_one_or_none()
    if not sl:
        raise HTTPException(404, "Больничный лист не найден")
    return _sick_leave_to_dict(sl)


@router.patch("/{sick_leave_id}/extend")
async def extend_sick_leave(
    sick_leave_id: uuid.UUID,
    data: ExtendSickLeaveRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Extend a sick leave by additional days."""
    sl = (await session.execute(
        select(SickLeave).where(SickLeave.id == sick_leave_id)
    )).scalar_one_or_none()
    if not sl:
        raise HTTPException(404, "Больничный лист не найден")
    if sl.status not in (SickLeaveStatus.ISSUED, SickLeaveStatus.EXTENDED):
        raise HTTPException(400, f"Нельзя продлить — текущий статус: {sl.status}")
    if data.additional_days <= 0:
        raise HTTPException(400, "Количество дней должно быть положительным")

    sl.end_date = sl.end_date + timedelta(days=data.additional_days)
    sl.extension_days = (sl.extension_days or 0) + data.additional_days
    sl.status = SickLeaveStatus.EXTENDED
    await session.flush()
    return _sick_leave_to_dict(sl)


@router.patch("/{sick_leave_id}/close")
async def close_sick_leave(
    sick_leave_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Close a sick leave."""
    sl = (await session.execute(
        select(SickLeave).where(SickLeave.id == sick_leave_id)
    )).scalar_one_or_none()
    if not sl:
        raise HTTPException(404, "Больничный лист не найден")
    if sl.status in (SickLeaveStatus.CLOSED, SickLeaveStatus.CANCELLED):
        raise HTTPException(400, f"Больничный уже {sl.status}")

    sl.status = SickLeaveStatus.CLOSED
    await session.flush()
    return _sick_leave_to_dict(sl)


@router.get("/{sick_leave_id}/print", response_class=HTMLResponse)
async def print_sick_leave(
    sick_leave_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Printable HTML version of sick leave."""
    sl = (await session.execute(
        select(SickLeave).where(SickLeave.id == sick_leave_id)
    )).scalar_one_or_none()
    if not sl:
        raise HTTPException(404, "Больничный лист не найден")

    patient = (await session.execute(
        select(Patient).where(Patient.id == sl.patient_id)
    )).scalar_one_or_none()
    patient_name = f"{patient.last_name} {patient.first_name}" if patient else "---"

    doctor = (await session.execute(
        select(User).where(User.id == sl.doctor_id)
    )).scalar_one_or_none()
    doctor_name = f"{doctor.last_name} {doctor.first_name}" if doctor else "---"

    status_labels = {
        "issued": "Выдан",
        "extended": "Продлён",
        "closed": "Закрыт",
        "cancelled": "Отменён",
        "draft": "Черновик",
    }

    total_days = (sl.end_date - sl.start_date).days + 1 if sl.start_date and sl.end_date else 0

    html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<title>Больничный лист {sl.number}</title>
<style>
body {{ font-family: 'Times New Roman', serif; max-width: 700px; margin: 40px auto; line-height: 1.6; }}
h1 {{ text-align: center; font-size: 20px; }}
h2 {{ text-align: center; font-size: 16px; color: #555; }}
table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
td {{ padding: 8px 12px; border: 1px solid #ccc; }}
td:first-child {{ font-weight: bold; width: 40%; background: #f9f9f9; }}
.footer {{ margin-top: 40px; display: flex; justify-content: space-between; }}
.signature {{ border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 4px; margin-top: 60px; }}
@media print {{ body {{ margin: 0; }} }}
</style></head><body>
<h1>ЛИСТОК НЕТРУДОСПОСОБНОСТИ</h1>
<h2>N {sl.number}</h2>
<table>
<tr><td>Пациент</td><td>{patient_name}</td></tr>
<tr><td>Врач</td><td>{doctor_name}</td></tr>
<tr><td>Диагноз (МКБ-10)</td><td>{sl.diagnosis_code or '---'} {sl.diagnosis_name or ''}</td></tr>
<tr><td>Дата начала</td><td>{sl.start_date.strftime('%d.%m.%Y') if sl.start_date else '---'}</td></tr>
<tr><td>Дата окончания</td><td>{sl.end_date.strftime('%d.%m.%Y') if sl.end_date else '---'}</td></tr>
<tr><td>Всего дней</td><td>{total_days} (продление: {sl.extension_days or 0} дн.)</td></tr>
<tr><td>Статус</td><td>{status_labels.get(sl.status, sl.status)}</td></tr>
<tr><td>Работодатель</td><td>{sl.employer_name or '---'}</td></tr>
<tr><td>Примечания</td><td>{sl.notes or '---'}</td></tr>
</table>
<div class="footer">
<div class="signature">Подпись врача</div>
<div class="signature">Печать клиники</div>
</div>
</body></html>"""
    return HTMLResponse(content=html)
