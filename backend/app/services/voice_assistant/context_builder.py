import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.treatment import TreatmentPlan
from app.models.laboratory import LabResult, LabOrder
from app.models.billing import Invoice

import structlog

logger = structlog.get_logger()


async def build_patient_context(
    patient_id: uuid.UUID,
    session: AsyncSession,
    page: str,
) -> dict:
    """Build a concise patient context dict for the AI system prompt."""
    patient = await session.get(Patient, patient_id)
    if not patient:
        return {}

    context = {
        "patient_name": f"{patient.last_name} {patient.first_name}",
        "current_page": page,
    }

    # --- Upcoming appointments (next 7 days) ---
    try:
        now = datetime.utcnow()
        week_ahead = now + timedelta(days=7)
        appts_q = (
            select(Appointment)
            .where(
                and_(
                    Appointment.patient_id == patient_id,
                    Appointment.scheduled_start >= now,
                    Appointment.scheduled_start <= week_ahead,
                )
            )
            .order_by(Appointment.scheduled_start)
            .limit(5)
        )
        appts_result = await session.execute(appts_q)
        appointments = appts_result.scalars().all()

        context["upcoming_appointments"] = [
            {
                "id": str(a.id),
                "doctor": (
                    f"{a.doctor.last_name} {a.doctor.first_name}"
                    if a.doctor
                    else "N/A"
                ),
                "specialization": (
                    a.doctor.specialization if a.doctor else None
                ),
                "date": a.scheduled_start.strftime("%Y-%m-%d %H:%M"),
            }
            for a in appointments
        ]
    except Exception as e:
        logger.warning("context_appointments_error", error=str(e))
        context["upcoming_appointments"] = []

    # --- Active treatment plans ---
    try:
        plans_q = (
            select(TreatmentPlan)
            .where(
                and_(
                    TreatmentPlan.patient_id == patient_id,
                    TreatmentPlan.status == "ACTIVE",
                )
            )
            .limit(3)
        )
        plans_result = await session.execute(plans_q)
        plans = plans_result.scalars().all()

        context["active_treatment"] = [
            {"title": p.title, "description": p.description}
            for p in plans
        ]
    except Exception as e:
        logger.warning("context_treatment_error", error=str(e))
        context["active_treatment"] = []

    # --- Recent lab results (last 30 days, via LabOrder -> LabResult) ---
    try:
        month_ago = now - timedelta(days=30)
        labs_q = (
            select(LabResult)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .options(selectinload(LabResult.lab_order).selectinload(LabOrder.test))
            .where(
                and_(
                    LabOrder.patient_id == patient_id,
                    LabResult.created_at >= month_ago,
                )
            )
            .order_by(LabResult.created_at.desc())
            .limit(5)
        )
        labs_result = await session.execute(labs_q)
        labs = labs_result.scalars().all()

        context["recent_results"] = [
            {
                "name": (
                    r.lab_order.test.name
                    if r.lab_order and r.lab_order.test
                    else "N/A"
                ),
                "date": r.created_at.strftime("%Y-%m-%d"),
                "status": r.status.value if r.status else None,
            }
            for r in labs
        ]
    except Exception as e:
        logger.warning("context_results_error", error=str(e))
        context["recent_results"] = []

    # --- Unpaid invoices (ISSUED or OVERDUE) ---
    try:
        inv_q = (
            select(Invoice)
            .where(
                and_(
                    Invoice.patient_id == patient_id,
                    Invoice.status.in_(["ISSUED", "OVERDUE"]),
                )
            )
            .limit(5)
        )
        inv_result = await session.execute(inv_q)
        invoices = inv_result.scalars().all()

        context["unpaid_bills"] = [
            {
                "id": str(i.id),
                "amount": float(i.total),
                "description": i.notes or "",
            }
            for i in invoices
        ]
    except Exception as e:
        logger.warning("context_bills_error", error=str(e))
        context["unpaid_bills"] = []

    return context
