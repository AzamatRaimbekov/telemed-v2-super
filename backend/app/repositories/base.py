import uuid
from typing import Any, Generic, TypeVar
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get_by_id(self, id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> ModelType | None:
        query = select(self.model).where(self.model.id == id, self.model.is_deleted == False)
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(self, clinic_id: uuid.UUID | None = None, skip: int = 0, limit: int = 20, filters: dict[str, Any] | None = None, order_by: str = "created_at", order_desc: bool = True) -> list[ModelType]:
        query = select(self.model).where(self.model.is_deleted == False)
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.where(getattr(self.model, key) == value)
        if hasattr(self.model, order_by):
            col = getattr(self.model, order_by)
            query = query.order_by(col.desc() if order_desc else col.asc())
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, obj_data: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_data)
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def update(self, id: uuid.UUID, obj_data: dict[str, Any], clinic_id: uuid.UUID | None = None) -> ModelType | None:
        db_obj = await self.get_by_id(id, clinic_id)
        if db_obj is None:
            return None
        for key, value in obj_data.items():
            if value is not None:
                setattr(db_obj, key, value)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def soft_delete(self, id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> bool:
        db_obj = await self.get_by_id(id, clinic_id)
        if db_obj is None:
            return False
        db_obj.is_deleted = True
        await self.session.flush()
        return True

    async def count(self, clinic_id: uuid.UUID | None = None, filters: dict[str, Any] | None = None) -> int:
        query = select(func.count()).select_from(self.model).where(self.model.is_deleted == False)
        if clinic_id is not None and hasattr(self.model, "clinic_id"):
            query = query.where(self.model.clinic_id == clinic_id)
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.where(getattr(self.model, key) == value)
        result = await self.session.execute(query)
        return result.scalar_one()
