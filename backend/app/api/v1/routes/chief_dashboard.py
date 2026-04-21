from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import Date, cast, func, select

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.appointment import Appointment, AppointmentStatus
from app.models.billing import Payment
from app.models.facility import Bed, BedAssignment, BedStatus
from app.models.laboratory import LabOrder, LabOrderStatus
from app.models.medication import Inventory
from app.models.patient import Patient
from app.models.user import User, UserRole

router = APIRouter(prefix="/chief-dashboard", tags=["Chief Dashboard"])


@router.get("/")
async def get_chief_dashboard(
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Get all KPIs for the chief doctor dashboard in a single call."""
    clinic_id = current_user.clinic_id
    now = datetime.now(timezone.utc)
    today = now.date()
    month_start = today.replace(day=1)
    week_ago = today - timedelta(days=7)

    # Previous month range for revenue comparison
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    not_deleted = True  # shorthand

    result = {
        "patients": {"total": 0, "new_this_month": 0, "new_this_week": 0},
        "appointments": {
            "today": 0,
            "this_week": 0,
            "completed_this_week": 0,
            "completion_rate": 0.0,
        },
        "beds": {"total": 0, "occupied": 0, "occupancy_rate": 0.0},
        "revenue": {"this_month": 0.0, "last_month": 0.0, "growth_percent": 0.0},
        "laboratory": {"pending_orders": 0, "completed_today": 0},
        "pharmacy": {"low_stock_items": 0, "total_items": 0},
        "staff": {"doctors": 0, "nurses": 0, "total": 0},
    }

    # --- Patients ---
    try:
        base = [Patient.clinic_id == clinic_id, Patient.is_deleted == False]
        total_q = select(func.count()).select_from(Patient).where(*base)
        new_month_q = select(func.count()).select_from(Patient).where(
            *base, Patient.created_at >= month_start
        )
        new_week_q = select(func.count()).select_from(Patient).where(
            *base, Patient.created_at >= week_ago
        )
        total_r, month_r, week_r = await session.execute(total_q), await session.execute(new_month_q), await session.execute(new_week_q)
        result["patients"]["total"] = total_r.scalar_one()
        result["patients"]["new_this_month"] = month_r.scalar_one()
        result["patients"]["new_this_week"] = week_r.scalar_one()
    except Exception:
        pass

    # --- Appointments ---
    try:
        base = [Appointment.clinic_id == clinic_id, Appointment.is_deleted == False]
        today_q = select(func.count()).select_from(Appointment).where(
            *base,
            cast(Appointment.scheduled_start, Date) == today,
        )
        week_q = select(func.count()).select_from(Appointment).where(
            *base,
            Appointment.scheduled_start >= week_ago,
        )
        completed_week_q = select(func.count()).select_from(Appointment).where(
            *base,
            Appointment.scheduled_start >= week_ago,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        today_r = (await session.execute(today_q)).scalar_one()
        week_r = (await session.execute(week_q)).scalar_one()
        completed_r = (await session.execute(completed_week_q)).scalar_one()

        result["appointments"]["today"] = today_r
        result["appointments"]["this_week"] = week_r
        result["appointments"]["completed_this_week"] = completed_r
        result["appointments"]["completion_rate"] = (
            round(completed_r / max(week_r, 1) * 100, 1)
        )
    except Exception:
        pass

    # --- Beds ---
    try:
        total_beds_q = select(func.count()).select_from(Bed).where(
            Bed.clinic_id == clinic_id, Bed.is_deleted == False
        )
        occupied_q = select(func.count()).select_from(Bed).where(
            Bed.clinic_id == clinic_id,
            Bed.is_deleted == False,
            Bed.status == BedStatus.OCCUPIED,
        )
        total_b = (await session.execute(total_beds_q)).scalar_one()
        occupied_b = (await session.execute(occupied_q)).scalar_one()

        result["beds"]["total"] = total_b
        result["beds"]["occupied"] = occupied_b
        result["beds"]["occupancy_rate"] = (
            round(occupied_b / max(total_b, 1) * 100, 1)
        )
    except Exception:
        pass

    # --- Revenue (from payments) ---
    try:
        this_month_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.clinic_id == clinic_id,
            Payment.is_deleted == False,
            Payment.paid_at >= month_start,
        )
        last_month_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.clinic_id == clinic_id,
            Payment.is_deleted == False,
            Payment.paid_at >= prev_month_start,
            Payment.paid_at < month_start,
        )
        this_m = float((await session.execute(this_month_q)).scalar_one())
        last_m = float((await session.execute(last_month_q)).scalar_one())

        result["revenue"]["this_month"] = this_m
        result["revenue"]["last_month"] = last_m
        result["revenue"]["growth_percent"] = (
            round((this_m - last_m) / max(last_m, 1) * 100, 1) if last_m else 0.0
        )
    except Exception:
        pass

    # --- Laboratory ---
    try:
        pending_q = select(func.count()).select_from(LabOrder).where(
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
            LabOrder.status.in_([
                LabOrderStatus.ORDERED,
                LabOrderStatus.SAMPLE_COLLECTED,
                LabOrderStatus.IN_PROGRESS,
            ]),
        )
        completed_today_q = select(func.count()).select_from(LabOrder).where(
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
            LabOrder.status == LabOrderStatus.COMPLETED,
            cast(LabOrder.updated_at, Date) == today,
        )
        result["laboratory"]["pending_orders"] = (await session.execute(pending_q)).scalar_one()
        result["laboratory"]["completed_today"] = (await session.execute(completed_today_q)).scalar_one()
    except Exception:
        pass

    # --- Pharmacy (inventory) ---
    try:
        total_items_q = select(func.count()).select_from(Inventory).where(
            Inventory.clinic_id == clinic_id,
            Inventory.is_deleted == False,
        )
        low_stock_q = select(func.count()).select_from(Inventory).where(
            Inventory.clinic_id == clinic_id,
            Inventory.is_deleted == False,
            Inventory.quantity <= Inventory.low_stock_threshold,
        )
        result["pharmacy"]["total_items"] = (await session.execute(total_items_q)).scalar_one()
        result["pharmacy"]["low_stock_items"] = (await session.execute(low_stock_q)).scalar_one()
    except Exception:
        pass

    # --- Staff ---
    try:
        doctors_q = select(func.count()).select_from(User).where(
            User.clinic_id == clinic_id,
            User.is_deleted == False,
            User.is_active == True,
            User.role == UserRole.DOCTOR,
        )
        nurses_q = select(func.count()).select_from(User).where(
            User.clinic_id == clinic_id,
            User.is_deleted == False,
            User.is_active == True,
            User.role == UserRole.NURSE,
        )
        docs = (await session.execute(doctors_q)).scalar_one()
        nurses = (await session.execute(nurses_q)).scalar_one()
        result["staff"]["doctors"] = docs
        result["staff"]["nurses"] = nurses
        result["staff"]["total"] = docs + nurses
    except Exception:
        pass

    return result
