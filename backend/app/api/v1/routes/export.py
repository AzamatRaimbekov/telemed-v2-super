from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.services.export_service import ExcelExporter

router = APIRouter(prefix="/export", tags=["export"])

EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _fmt_dt(dt: datetime | None) -> str:
    return dt.strftime("%d.%m.%Y %H:%M") if dt else ""


def _fmt_date(d) -> str:
    return d.strftime("%d.%m.%Y") if d else ""


# ── Patients Excel ───────────────────────────────────────────────────────────


@router.get("/patients/excel")
async def export_patients_excel(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(None),
):
    query = select(Patient).where(
        Patient.clinic_id == current_user.clinic_id,
        Patient.is_deleted == False,
    )
    if status:
        query = query.where(Patient.status == status)
    query = query.order_by(Patient.last_name)

    result = await session.execute(query)
    patients = result.scalars().all()

    headers = [
        "ФИО", "Дата рождения", "Пол", "Телефон",
        "Паспорт", "ИНН", "Страховка", "Статус", "Дата регистрации",
    ]
    rows = []
    for p in patients:
        rows.append([
            f"{p.last_name} {p.first_name} {p.middle_name or ''}".strip(),
            _fmt_date(p.date_of_birth),
            p.gender.value if p.gender else "",
            p.phone or "",
            p.passport_number or "",
            p.inn or "",
            p.insurance_number or "",
            p.status.value if p.status else "",
            _fmt_dt(p.created_at),
        ])

    buffer = ExcelExporter.create_report(
        title="Список пациентов",
        headers=headers,
        rows=rows,
        sheet_name="Пациенты",
    )
    return StreamingResponse(
        buffer,
        media_type=EXCEL_CONTENT_TYPE,
        headers={"Content-Disposition": "attachment; filename=patients.xlsx"},
    )


# ── Appointments Excel ───────────────────────────────────────────────────────


@router.get("/appointments/excel")
async def export_appointments_excel(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = Query(None),
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
):
    query = select(Appointment).where(
        Appointment.clinic_id == current_user.clinic_id,
        Appointment.is_deleted == False,
    )
    if status:
        query = query.where(Appointment.status == status)
    if date_from:
        query = query.where(Appointment.scheduled_start >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(Appointment.scheduled_start <= datetime.fromisoformat(date_to + "T23:59:59"))
    query = query.order_by(Appointment.scheduled_start.desc())

    result = await session.execute(query)
    appointments = result.scalars().all()

    headers = [
        "Пациент", "Врач", "Тип", "Статус",
        "Назначено на", "Причина", "Примечания",
    ]
    rows = []
    for a in appointments:
        patient_name = ""
        if a.patient:
            patient_name = f"{a.patient.last_name} {a.patient.first_name}"
        doctor_name = ""
        if a.doctor:
            doctor_name = f"{a.doctor.last_name} {a.doctor.first_name}"
        rows.append([
            patient_name,
            doctor_name,
            a.appointment_type.value if a.appointment_type else "",
            a.status.value if a.status else "",
            _fmt_dt(a.scheduled_start),
            a.reason or "",
            a.notes or "",
        ])

    buffer = ExcelExporter.create_report(
        title="Список приёмов",
        headers=headers,
        rows=rows,
        sheet_name="Приёмы",
    )
    return StreamingResponse(
        buffer,
        media_type=EXCEL_CONTENT_TYPE,
        headers={"Content-Disposition": "attachment; filename=appointments.xlsx"},
    )


# ── Payments Excel ───────────────────────────────────────────────────────────


@router.get("/payments/excel")
async def export_payments_excel(
    session: DBSession,
    current_user: CurrentUser,
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
):
    query = (
        select(Invoice)
        .where(
            Invoice.clinic_id == current_user.clinic_id,
            Invoice.is_deleted == False,
        )
        .order_by(Invoice.created_at.desc())
    )
    if date_from:
        query = query.where(Invoice.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(Invoice.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))

    result = await session.execute(query)
    invoices = result.scalars().all()

    headers = [
        "Номер счёта", "Пациент", "Статус", "Итого",
        "Скидка", "Оплачено", "Способ оплаты", "Дата создания",
    ]
    rows = []
    for inv in invoices:
        patient_name = ""
        if inv.patient:
            patient_name = f"{inv.patient.last_name} {inv.patient.first_name}"
        paid_total = sum(float(p.amount) for p in (inv.payments or []))
        methods = ", ".join(set(p.payment_method.value for p in (inv.payments or []))) if inv.payments else ""
        rows.append([
            inv.invoice_number,
            patient_name,
            inv.status.value if inv.status else "",
            float(inv.total or 0),
            float(inv.discount or 0),
            paid_total,
            methods,
            _fmt_dt(inv.created_at),
        ])

    buffer = ExcelExporter.create_report(
        title="Отчёт по оплатам",
        headers=headers,
        rows=rows,
        sheet_name="Оплаты",
    )
    return StreamingResponse(
        buffer,
        media_type=EXCEL_CONTENT_TYPE,
        headers={"Content-Disposition": "attachment; filename=payments.xlsx"},
    )
