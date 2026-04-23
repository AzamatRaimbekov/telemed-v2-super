from fastapi import APIRouter, Query
from datetime import date, timedelta
from sqlalchemy import select, func, and_, cast, Date
from app.api.deps import CurrentUser, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import User, UserRole
from app.models.billing import Payment

router = APIRouter(prefix="/reports/doctors", tags=["Reports - Doctors"])

@router.get("/efficiency")
async def doctor_efficiency(
    session: DBSession,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Get efficiency metrics per doctor: appointments count, completion rate, avg time, revenue."""
    clinic_id = current_user.clinic_id
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()

    # Get all doctors
    doctors_result = await session.execute(
        select(User).where(and_(
            User.clinic_id == clinic_id,
            User.role == UserRole.DOCTOR,
            User.is_deleted == False,
        ))
    )
    doctors = doctors_result.scalars().all()

    report = []
    for doc in doctors:
        # Count appointments
        total_q = await session.execute(
            select(func.count(Appointment.id)).where(and_(
                Appointment.doctor_id == doc.id,
                Appointment.clinic_id == clinic_id,
                cast(Appointment.created_at, Date) >= date_from,
                cast(Appointment.created_at, Date) <= date_to,
            ))
        )
        total = total_q.scalar() or 0

        # Completed appointments
        completed_q = await session.execute(
            select(func.count(Appointment.id)).where(and_(
                Appointment.doctor_id == doc.id,
                Appointment.clinic_id == clinic_id,
                Appointment.status == AppointmentStatus.COMPLETED,
                cast(Appointment.created_at, Date) >= date_from,
                cast(Appointment.created_at, Date) <= date_to,
            ))
        )
        completed = completed_q.scalar() or 0

        completion_rate = round(completed / total * 100, 1) if total > 0 else 0

        report.append({
            "doctor_id": str(doc.id),
            "name": f"{doc.last_name} {doc.first_name}",
            "specialization": getattr(doc, "specialization", None),
            "total_appointments": total,
            "completed_appointments": completed,
            "completion_rate": completion_rate,
            "avg_per_day": round(total / max((date_to - date_from).days, 1), 1),
        })

    report.sort(key=lambda x: x["total_appointments"], reverse=True)
    return {"period": {"from": date_from.isoformat(), "to": date_to.isoformat()}, "doctors": report}

@router.get("/ranking")
async def doctor_ranking(
    session: DBSession,
    current_user: CurrentUser,
):
    """Top doctors by appointment count this month."""
    today = date.today()
    month_start = today.replace(day=1)

    result = await session.execute(
        select(
            Appointment.doctor_id,
            func.count(Appointment.id).label("count"),
        ).where(and_(
            Appointment.clinic_id == current_user.clinic_id,
            cast(Appointment.created_at, Date) >= month_start,
        )).group_by(Appointment.doctor_id).order_by(func.count(Appointment.id).desc()).limit(10)
    )
    rows = result.all()

    ranking = []
    for doc_id, count in rows:
        doc = (await session.execute(select(User).where(User.id == doc_id))).scalar_one_or_none()
        if doc:
            ranking.append({
                "doctor_id": str(doc.id),
                "name": f"{doc.last_name} {doc.first_name}",
                "appointments": count,
            })
    return ranking
