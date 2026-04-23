from fastapi import APIRouter
from sqlalchemy import select, func, and_
from datetime import date, datetime, timezone
import uuid

from app.api.deps import DBSession
from app.models.queue import QueueEntry, QueueStatus

router = APIRouter(prefix="/wait-time", tags=["Wait Time"])


@router.get("/estimate/{queue_id}")
async def estimate_wait(queue_id: str, session: DBSession):
    """Estimate wait time for patient in queue."""
    entry = (await session.execute(
        select(QueueEntry).where(QueueEntry.id == uuid.UUID(queue_id))
    )).scalar_one_or_none()
    if not entry:
        return {"error": "Not found"}

    # Count people ahead
    ahead = (await session.execute(
        select(func.count(QueueEntry.id)).where(and_(
            QueueEntry.clinic_id == entry.clinic_id,
            QueueEntry.status == QueueStatus.WAITING,
            QueueEntry.queue_number < entry.queue_number,
            func.date(QueueEntry.created_at) == date.today(),
        ))
    )).scalar() or 0

    avg_service_time = 15  # minutes per patient
    estimated_minutes = ahead * avg_service_time

    return {
        "queue_number": entry.queue_number,
        "people_ahead": ahead,
        "estimated_minutes": estimated_minutes,
        "estimated_time": f"~{estimated_minutes} мин",
    }


@router.get("/display/{clinic_id}")
async def wait_display(clinic_id: str, session: DBSession):
    """Public display of current wait times per room/doctor."""
    waiting = (await session.execute(
        select(func.count(QueueEntry.id)).where(and_(
            QueueEntry.clinic_id == uuid.UUID(clinic_id),
            QueueEntry.status == QueueStatus.WAITING,
            func.date(QueueEntry.created_at) == date.today(),
        ))
    )).scalar() or 0

    return {
        "total_waiting": waiting,
        "avg_wait_minutes": waiting * 15,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
