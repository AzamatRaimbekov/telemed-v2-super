from fastapi import APIRouter
from datetime import date, timedelta
from sqlalchemy import select, func, and_, desc
from app.api.deps import DBSession
from app.models.dental_chart import ToothTreatment, DentalChart

router = APIRouter(prefix="/portal/dental", tags=["Portal Dental"])


@router.get("/cleaning-reminder")
async def cleaning_reminder(session: DBSession, patient_id: str = None):
    """Check when last professional cleaning was and remind if > 6 months."""
    import uuid as _uuid
    if not patient_id:
        return {"needs_cleaning": True, "message": "Рекомендуем записаться на профчистку", "months_since": None}

    result = await session.execute(
        select(ToothTreatment).where(and_(
            ToothTreatment.patient_id == _uuid.UUID(patient_id),
            ToothTreatment.procedure_name.ilike("%чистк%"),
        )).order_by(desc(ToothTreatment.created_at)).limit(1)
    )
    last_cleaning = result.scalar_one_or_none()

    if not last_cleaning:
        return {"needs_cleaning": True, "last_cleaning": None, "months_since": None,
                "message": "У вас нет записей о профчистке. Рекомендуем записаться!"}

    days_since = (date.today() - last_cleaning.created_at.date()).days
    months_since = days_since // 30
    needs = months_since >= 6

    return {
        "needs_cleaning": needs,
        "last_cleaning": last_cleaning.created_at.isoformat(),
        "months_since": months_since,
        "message": f"Прошло {months_since} мес. с последней чистки. {'Пора записаться!' if needs else 'Всё хорошо!'}"
    }


@router.get("/my-teeth")
async def my_teeth(session: DBSession, patient_id: str = None):
    """Get patient's dental chart for portal view."""
    if not patient_id:
        return {"teeth": {}, "message": "Зубная карта не найдена"}

    import uuid as _uuid
    result = await session.execute(
        select(DentalChart).where(DentalChart.patient_id == _uuid.UUID(patient_id))
    )
    chart = result.scalar_one_or_none()
    if not chart:
        return {"teeth": {}, "message": "Зубная карта ещё не заполнена"}
    return {"teeth": chart.teeth, "notes": chart.notes}


@router.get("/my-treatments")
async def my_treatments(session: DBSession, patient_id: str = None):
    """Get patient's treatment history."""
    if not patient_id:
        return []
    import uuid as _uuid
    result = await session.execute(
        select(ToothTreatment).where(
            ToothTreatment.patient_id == _uuid.UUID(patient_id)
        ).order_by(desc(ToothTreatment.created_at)).limit(50)
    )
    treatments = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "tooth_number": t.tooth_number,
            "procedure": t.procedure_name,
            "diagnosis": t.diagnosis,
            "price": t.price,
            "date": t.created_at.isoformat(),
            "notes": t.notes,
        } for t in treatments
    ]
