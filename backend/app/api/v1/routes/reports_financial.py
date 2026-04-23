from fastapi import APIRouter, Query
from datetime import date, timedelta
from sqlalchemy import select, func, and_, cast, Date, extract
from app.api.deps import CurrentUser, DBSession
from app.models.billing import Invoice, Payment

router = APIRouter(prefix="/reports/financial", tags=["Reports - Financial"])

@router.get("/pl")
async def profit_loss(
    session: DBSession,
    current_user: CurrentUser,
    months: int = Query(default=6, le=24),
):
    """Profit & Loss report by months."""
    clinic_id = current_user.clinic_id
    today = date.today()

    report = []
    for i in range(months - 1, -1, -1):
        month_date = today.replace(day=1) - timedelta(days=i * 30)
        year = month_date.year
        month = month_date.month

        # Revenue (payments received)
        revenue_q = await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(and_(
                Payment.clinic_id == clinic_id,
                extract("year", Payment.created_at) == year,
                extract("month", Payment.created_at) == month,
            ))
        )
        revenue = float(revenue_q.scalar() or 0)

        # Invoices created (billed)
        billed_q = await session.execute(
            select(func.coalesce(func.sum(Invoice.total), 0)).where(and_(
                Invoice.clinic_id == clinic_id,
                extract("year", Invoice.created_at) == year,
                extract("month", Invoice.created_at) == month,
            ))
        )
        billed = float(billed_q.scalar() or 0)

        # Invoice count
        inv_count = (await session.execute(
            select(func.count(Invoice.id)).where(and_(
                Invoice.clinic_id == clinic_id,
                extract("year", Invoice.created_at) == year,
                extract("month", Invoice.created_at) == month,
            ))
        )).scalar() or 0

        month_names = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

        report.append({
            "year": year,
            "month": month,
            "month_name": month_names[month],
            "revenue": revenue,
            "billed": billed,
            "invoices_count": inv_count,
            "collection_rate": round(revenue / billed * 100, 1) if billed > 0 else 0,
        })

    total_revenue = sum(r["revenue"] for r in report)
    total_billed = sum(r["billed"] for r in report)

    return {
        "period_months": months,
        "months": report,
        "totals": {
            "revenue": total_revenue,
            "billed": total_billed,
            "collection_rate": round(total_revenue / total_billed * 100, 1) if total_billed > 0 else 0,
        },
    }

@router.get("/daily")
async def daily_revenue(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=30, le=90),
):
    """Daily revenue for last N days."""
    clinic_id = current_user.clinic_id
    today = date.today()

    data = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        rev = (await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(and_(
                Payment.clinic_id == clinic_id,
                cast(Payment.created_at, Date) == d,
            ))
        )).scalar() or 0

        data.append({"date": d.isoformat(), "revenue": float(rev)})

    return data
