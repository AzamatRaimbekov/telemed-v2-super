from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from app.models.prediction import Prediction, PredictionType


class PredictiveService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def forecast_bed_occupancy(self, clinic_id, days_ahead: int = 7) -> list[dict]:
        """Forecast bed occupancy for next N days using 14-day moving average."""
        from app.models.facility import BedAssignment

        today = date.today()
        # Get historical daily counts for last 30 days
        history = []
        for i in range(30, 0, -1):
            d = today - timedelta(days=i)
            result = await self.db.execute(
                select(func.count(BedAssignment.id)).where(and_(
                    BedAssignment.clinic_id == clinic_id,
                    cast(BedAssignment.created_at, Date) <= d,
                    BedAssignment.discharged_at.is_(None) | (cast(BedAssignment.discharged_at, Date) > d),
                ))
            )
            count = result.scalar() or 0
            history.append(count)

        # Simple moving average forecast
        if len(history) >= 14:
            avg = sum(history[-14:]) / 14
        elif history:
            avg = sum(history) / len(history)
        else:
            avg = 0

        forecasts = []
        for i in range(days_ahead):
            target = today + timedelta(days=i + 1)
            # Add small variation based on day of week
            dow_factor = 1.0 + (target.weekday() - 3) * 0.02  # slightly higher mid-week
            predicted = round(avg * dow_factor, 1)
            forecasts.append({
                "date": target.isoformat(),
                "predicted": predicted,
                "low": round(predicted * 0.85, 1),
                "high": round(predicted * 1.15, 1),
            })
        return forecasts

    async def forecast_admissions(self, clinic_id, days_ahead: int = 7) -> list[dict]:
        """Forecast patient admissions."""
        from app.models.appointment import Appointment

        today = date.today()
        history = []
        for i in range(30, 0, -1):
            d = today - timedelta(days=i)
            result = await self.db.execute(
                select(func.count(Appointment.id)).where(and_(
                    Appointment.clinic_id == clinic_id,
                    cast(Appointment.created_at, Date) == d,
                ))
            )
            count = result.scalar() or 0
            history.append(count)

        avg = sum(history[-14:]) / max(len(history[-14:]), 1) if history else 0

        forecasts = []
        for i in range(days_ahead):
            target = today + timedelta(days=i + 1)
            dow_factor = 0.3 if target.weekday() >= 5 else 1.0  # weekends lower
            predicted = round(avg * dow_factor, 1)
            forecasts.append({
                "date": target.isoformat(),
                "predicted": predicted,
                "low": round(max(predicted * 0.7, 0), 1),
                "high": round(predicted * 1.3, 1),
            })
        return forecasts

    async def forecast_medication(self, clinic_id, days_ahead: int = 30) -> list[dict]:
        """Forecast medication consumption -- which drugs will run out."""
        from app.models.medication import Inventory

        result = await self.db.execute(
            select(Inventory).where(Inventory.clinic_id == clinic_id)
        )
        items = result.scalars().all()

        alerts = []
        for item in items:
            qty = item.quantity or 0
            threshold = item.low_stock_threshold or 10
            # Estimate daily consumption (simplified)
            daily_use = max(threshold / 7, 1)  # rough estimate
            days_left = qty / daily_use if daily_use > 0 else 999

            if days_left <= days_ahead:
                drug_name = "Unknown"
                if item.drug:
                    drug_name = item.drug.name
                alerts.append({
                    "item_id": str(item.id),
                    "name": drug_name,
                    "current_quantity": qty,
                    "daily_consumption": round(daily_use, 1),
                    "days_until_empty": round(days_left, 0),
                    "reorder_date": (date.today() + timedelta(days=int(days_left))).isoformat(),
                    "urgency": "critical" if days_left <= 3 else "warning" if days_left <= 7 else "info",
                })

        return sorted(alerts, key=lambda x: x["days_until_empty"])
