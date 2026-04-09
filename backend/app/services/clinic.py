import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ConflictError, NotFoundError
from app.models.clinic import Clinic
from app.repositories.clinic import ClinicRepository
from app.schemas.clinic import ClinicCreate, ClinicUpdate

class ClinicService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ClinicRepository(session)

    async def create_clinic(self, data: ClinicCreate) -> Clinic:
        existing = await self.repo.get_by_slug(data.slug)
        if existing:
            raise ConflictError(f"Clinic with slug '{data.slug}' already exists")
        return await self.repo.create(data.model_dump())

    async def get_clinic(self, clinic_id: uuid.UUID) -> Clinic:
        clinic = await self.repo.get_by_id(clinic_id)
        if clinic is None:
            raise NotFoundError("Clinic", str(clinic_id))
        return clinic

    async def list_clinics(self, skip: int = 0, limit: int = 20) -> list[Clinic]:
        return await self.repo.get_multi(skip=skip, limit=limit)

    async def update_clinic(self, clinic_id: uuid.UUID, data: ClinicUpdate) -> Clinic:
        clinic = await self.repo.update(clinic_id, data.model_dump(exclude_unset=True))
        if clinic is None:
            raise NotFoundError("Clinic", str(clinic_id))
        return clinic

    async def delete_clinic(self, clinic_id: uuid.UUID) -> None:
        deleted = await self.repo.soft_delete(clinic_id)
        if not deleted:
            raise NotFoundError("Clinic", str(clinic_id))
