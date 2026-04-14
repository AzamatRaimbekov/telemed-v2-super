from __future__ import annotations
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from sqlalchemy import select, func, case, and_
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole, User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical import Visit
from app.models.medication import Prescription
from app.models.procedure import ProcedureOrder
from app.models.laboratory import LabOrder

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard(
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
    period_days: int = Query(30, ge=1, le=365),
):
    clinic_id = current_user.clinic_id
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=period_days)
    prev_start = period_start - timedelta(days=period_days)

    # --- Patient stats ---
    total_patients = await _count(session, Patient, Patient.clinic_id == clinic_id, Patient.is_deleted == False)
    active_patients = await _count(session, Patient, Patient.clinic_id == clinic_id, Patient.is_deleted == False, Patient.status == "ACTIVE")
    new_patients_current = await _count(session, Patient, Patient.clinic_id == clinic_id, Patient.is_deleted == False, Patient.created_at >= period_start)
    new_patients_prev = await _count(session, Patient, Patient.clinic_id == clinic_id, Patient.is_deleted == False, Patient.created_at >= prev_start, Patient.created_at < period_start)

    # --- Staff stats ---
    total_doctors = await _count(session, User, User.clinic_id == clinic_id, User.is_deleted == False, User.role == UserRole.DOCTOR, User.is_active == True)
    total_nurses = await _count(session, User, User.clinic_id == clinic_id, User.is_deleted == False, User.role == UserRole.NURSE, User.is_active == True)

    # --- Appointment stats ---
    total_appointments = await _count(session, Appointment, Appointment.clinic_id == clinic_id, Appointment.is_deleted == False, Appointment.scheduled_start >= period_start)
    completed_appointments = await _count(session, Appointment, Appointment.clinic_id == clinic_id, Appointment.is_deleted == False, Appointment.scheduled_start >= period_start, Appointment.status == "COMPLETED")
    cancelled_appointments = await _count(session, Appointment, Appointment.clinic_id == clinic_id, Appointment.is_deleted == False, Appointment.scheduled_start >= period_start, Appointment.status == "CANCELLED")
    no_show_appointments = await _count(session, Appointment, Appointment.clinic_id == clinic_id, Appointment.is_deleted == False, Appointment.scheduled_start >= period_start, Appointment.status == "NO_SHOW")

    # --- Prescriptions ---
    active_prescriptions = await _count(session, Prescription, Prescription.clinic_id == clinic_id, Prescription.is_deleted == False, Prescription.status == "ACTIVE")

    # --- Procedures ---
    procedures_current = await _count(session, ProcedureOrder, ProcedureOrder.clinic_id == clinic_id, ProcedureOrder.is_deleted == False, ProcedureOrder.created_at >= period_start)
    procedures_completed = await _count(session, ProcedureOrder, ProcedureOrder.clinic_id == clinic_id, ProcedureOrder.is_deleted == False, ProcedureOrder.status == "COMPLETED", ProcedureOrder.created_at >= period_start)

    # --- Lab orders ---
    lab_orders_current = await _count(session, LabOrder, LabOrder.clinic_id == clinic_id, LabOrder.is_deleted == False, LabOrder.created_at >= period_start)
    lab_completed = await _count(session, LabOrder, LabOrder.clinic_id == clinic_id, LabOrder.is_deleted == False, LabOrder.status == "COMPLETED", LabOrder.created_at >= period_start)

    # --- Appointments by day (for chart) ---
    from sqlalchemy import cast, Date
    appt_by_day_q = (
        select(
            cast(Appointment.scheduled_start, Date).label("day"),
            func.count().label("count"),
        )
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.is_deleted == False,
            Appointment.scheduled_start >= period_start,
        )
        .group_by(cast(Appointment.scheduled_start, Date))
        .order_by(cast(Appointment.scheduled_start, Date))
    )
    appt_by_day_result = await session.execute(appt_by_day_q)
    appointments_by_day = [{"date": str(row.day), "count": row.count} for row in appt_by_day_result.all()]

    # --- Top doctors by appointments ---
    top_doctors_q = (
        select(
            Appointment.doctor_id,
            func.count().label("count"),
        )
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.is_deleted == False,
            Appointment.scheduled_start >= period_start,
        )
        .group_by(Appointment.doctor_id)
        .order_by(func.count().desc())
        .limit(5)
    )
    top_doctors_result = await session.execute(top_doctors_q)
    top_doctors_raw = top_doctors_result.all()

    top_doctors = []
    for row in top_doctors_raw:
        doc_q = select(User).where(User.id == row.doctor_id)
        doc_result = await session.execute(doc_q)
        doc = doc_result.scalar_one_or_none()
        if doc:
            top_doctors.append({
                "id": str(doc.id),
                "name": f"{doc.last_name} {doc.first_name}",
                "specialization": doc.specialization,
                "appointments": row.count,
            })

    # --- Patient registrations by day ---
    reg_by_day_q = (
        select(
            cast(Patient.created_at, Date).label("day"),
            func.count().label("count"),
        )
        .where(
            Patient.clinic_id == clinic_id,
            Patient.is_deleted == False,
            Patient.created_at >= period_start,
        )
        .group_by(cast(Patient.created_at, Date))
        .order_by(cast(Patient.created_at, Date))
    )
    reg_by_day_result = await session.execute(reg_by_day_q)
    registrations_by_day = [{"date": str(row.day), "count": row.count} for row in reg_by_day_result.all()]

    return {
        "period_days": period_days,
        "patients": {
            "total": total_patients,
            "active": active_patients,
            "new_current": new_patients_current,
            "new_previous": new_patients_prev,
        },
        "staff": {
            "doctors": total_doctors,
            "nurses": total_nurses,
        },
        "appointments": {
            "total": total_appointments,
            "completed": completed_appointments,
            "cancelled": cancelled_appointments,
            "no_show": no_show_appointments,
            "completion_rate": round(completed_appointments / max(total_appointments, 1) * 100, 1),
            "by_day": appointments_by_day,
        },
        "prescriptions": {
            "active": active_prescriptions,
        },
        "procedures": {
            "total": procedures_current,
            "completed": procedures_completed,
        },
        "lab_orders": {
            "total": lab_orders_current,
            "completed": lab_completed,
        },
        "top_doctors": top_doctors,
        "registrations_by_day": registrations_by_day,
    }


async def _count(session, model, *filters) -> int:
    q = select(func.count()).select_from(model).where(*filters)
    result = await session.execute(q)
    return result.scalar_one()
