from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.clinic import Clinic
from app.repositories.base import BaseRepository

class ClinicRepository(BaseRepository[Clinic]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Clinic, session)

    async def get_by_slug(self, slug: str) -> Clinic | None:
        query = select(Clinic).where(Clinic.slug == slug, Clinic.is_deleted == False)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
