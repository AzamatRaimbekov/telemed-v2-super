from datetime import date, datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.queue import QueueEntry, QueueStatus


class QueueService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_to_queue(
        self,
        clinic_id,
        patient_id,
        doctor_id=None,
        appointment_id=None,
        room_name=None,
        display_name=None,
    ):
        today = date.today()
        result = await self.db.execute(
            select(func.coalesce(func.max(QueueEntry.queue_number), 0)).where(
                and_(
                    QueueEntry.clinic_id == clinic_id,
                    func.date(QueueEntry.created_at) == today,
                )
            )
        )
        next_number = result.scalar() + 1

        entry = QueueEntry(
            queue_number=next_number,
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_id=appointment_id,
            clinic_id=clinic_id,
            room_name=room_name,
            display_name=display_name,
            status=QueueStatus.WAITING,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def call_next(self, clinic_id, doctor_id=None):
        """Call next waiting patient."""
        query = (
            select(QueueEntry)
            .where(
                and_(
                    QueueEntry.clinic_id == clinic_id,
                    QueueEntry.status == QueueStatus.WAITING,
                    func.date(QueueEntry.created_at) == date.today(),
                )
            )
        )
        if doctor_id:
            query = query.where(QueueEntry.doctor_id == doctor_id)
        query = query.order_by(QueueEntry.queue_number.asc()).limit(1)

        result = await self.db.execute(query)
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = QueueStatus.CALLED
            entry.called_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(entry)
        return entry

    async def start_service(self, entry_id):
        result = await self.db.execute(
            select(QueueEntry).where(QueueEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = QueueStatus.IN_PROGRESS
            await self.db.commit()
            await self.db.refresh(entry)
        return entry

    async def complete_service(self, entry_id):
        result = await self.db.execute(
            select(QueueEntry).where(QueueEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = QueueStatus.COMPLETED
            entry.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(entry)
        return entry

    async def skip_patient(self, entry_id):
        result = await self.db.execute(
            select(QueueEntry).where(QueueEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = QueueStatus.SKIPPED
            await self.db.commit()
            await self.db.refresh(entry)
        return entry

    async def get_today_queue(self, clinic_id):
        result = await self.db.execute(
            select(QueueEntry)
            .where(
                and_(
                    QueueEntry.clinic_id == clinic_id,
                    func.date(QueueEntry.created_at) == date.today(),
                    QueueEntry.status.in_(
                        [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]
                    ),
                )
            )
            .order_by(QueueEntry.queue_number.asc())
        )
        return result.scalars().all()

    async def get_lobby_display(self, clinic_id):
        """Get data for lobby TV display - current and next patients per room."""
        entries = await self.get_today_queue(clinic_id)

        rooms: dict = {}
        for entry in entries:
            room = entry.room_name or "Общая"
            if room not in rooms:
                rooms[room] = {"current": None, "waiting": []}

            if entry.status in (QueueStatus.CALLED, QueueStatus.IN_PROGRESS):
                rooms[room]["current"] = {
                    "queue_number": entry.queue_number,
                    "display_name": entry.display_name,
                    "status": entry.status.value,
                }
            elif entry.status == QueueStatus.WAITING:
                rooms[room]["waiting"].append(
                    {
                        "queue_number": entry.queue_number,
                        "display_name": entry.display_name,
                    }
                )

        return rooms
