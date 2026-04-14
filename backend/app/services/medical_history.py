from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.medical_history import MedicalHistoryEntry, HistoryEntryType


class MedicalHistoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_entries(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        entry_type: str | None = None,
        period: str | None = None,
        author_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[MedicalHistoryEntry], int]:
        base_where = [
            MedicalHistoryEntry.patient_id == patient_id,
            MedicalHistoryEntry.clinic_id == clinic_id,
            MedicalHistoryEntry.is_deleted == False,
        ]

        if entry_type:
            base_where.append(MedicalHistoryEntry.entry_type == entry_type)

        if author_id:
            base_where.append(MedicalHistoryEntry.author_id == author_id)

        if period:
            cutoff = self._parse_period(period)
            if cutoff:
                base_where.append(MedicalHistoryEntry.recorded_at >= cutoff)

        count_query = select(func.count()).select_from(MedicalHistoryEntry).where(*base_where)
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        query = (
            select(MedicalHistoryEntry)
            .where(*base_where)
            .order_by(MedicalHistoryEntry.recorded_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def get_entry(self, entry_id: uuid.UUID, clinic_id: uuid.UUID) -> MedicalHistoryEntry:
        query = select(MedicalHistoryEntry).where(
            MedicalHistoryEntry.id == entry_id,
            MedicalHistoryEntry.clinic_id == clinic_id,
            MedicalHistoryEntry.is_deleted == False,
        )
        result = await self.session.execute(query)
        entry = result.scalar_one_or_none()
        if not entry:
            raise NotFoundError("MedicalHistoryEntry", str(entry_id))
        return entry

    async def create_entry(self, data: dict, author_id: uuid.UUID, clinic_id: uuid.UUID) -> MedicalHistoryEntry:
        from app.models.medical_history import SourceType

        # Convert string enum values to actual enums
        entry_type_raw = data.pop("entry_type", None)
        source_type_raw = data.pop("source_type", None)

        entry_type = HistoryEntryType(entry_type_raw) if entry_type_raw else HistoryEntryType.MANUAL
        source_type = SourceType(source_type_raw) if source_type_raw else None

        # Remove fields that don't belong on the model
        data.pop("is_verified", None)
        data.pop("document_url", None)

        entry = MedicalHistoryEntry(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            author_id=author_id,
            entry_type=entry_type,
            source_type=source_type,
            **data,
        )
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def update_entry(self, entry_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> MedicalHistoryEntry:
        entry = await self.get_entry(entry_id, clinic_id)
        for key, value in data.items():
            if value is not None and hasattr(entry, key):
                setattr(entry, key, value)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def delete_entry(self, entry_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        entry = await self.get_entry(entry_id, clinic_id)
        entry.is_deleted = True
        await self.session.flush()

    async def verify_entry(self, entry_id: uuid.UUID, clinic_id: uuid.UUID) -> MedicalHistoryEntry:
        entry = await self.get_entry(entry_id, clinic_id)
        entry.is_verified = True
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def get_stats(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[dict]:
        query = (
            select(
                MedicalHistoryEntry.entry_type,
                func.count().label("count"),
            )
            .where(
                MedicalHistoryEntry.patient_id == patient_id,
                MedicalHistoryEntry.clinic_id == clinic_id,
                MedicalHistoryEntry.is_deleted == False,
            )
            .group_by(MedicalHistoryEntry.entry_type)
        )
        result = await self.session.execute(query)
        return [
            {"entry_type": row.entry_type.value if hasattr(row.entry_type, "value") else str(row.entry_type), "count": row.count}
            for row in result.all()
        ]

    @staticmethod
    def _parse_period(period: str) -> datetime | None:
        now = datetime.now(timezone.utc)
        if not period:
            return None
        unit = period[-1].lower()
        try:
            amount = int(period[:-1])
        except (ValueError, IndexError):
            return None
        if unit == "d":
            return now - timedelta(days=amount)
        elif unit == "w":
            return now - timedelta(weeks=amount)
        elif unit == "m":
            return now - timedelta(days=amount * 30)
        elif unit == "y":
            return now - timedelta(days=amount * 365)
        return None
