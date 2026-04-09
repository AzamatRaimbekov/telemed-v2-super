import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate

class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)

    async def create_user(self, data: UserCreate, clinic_id: uuid.UUID) -> User:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictError(f"User with email {data.email} already exists")
        user_data = data.model_dump(exclude={"password"})
        user_data["hashed_password"] = hash_password(data.password)
        user_data["clinic_id"] = clinic_id
        return await self.repo.create(user_data)

    async def get_user(self, user_id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> User:
        user = await self.repo.get_by_id(user_id, clinic_id)
        if user is None:
            raise NotFoundError("User", str(user_id))
        return user

    async def list_users(self, clinic_id: uuid.UUID, skip: int = 0, limit: int = 20, role: str | None = None) -> list[User]:
        filters = {}
        if role:
            filters["role"] = role
        return await self.repo.get_multi(clinic_id=clinic_id, skip=skip, limit=limit, filters=filters)

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate, clinic_id: uuid.UUID | None = None) -> User:
        user = await self.repo.update(user_id, data.model_dump(exclude_unset=True), clinic_id)
        if user is None:
            raise NotFoundError("User", str(user_id))
        return user

    async def delete_user(self, user_id: uuid.UUID, clinic_id: uuid.UUID | None = None) -> None:
        deleted = await self.repo.soft_delete(user_id, clinic_id)
        if not deleted:
            raise NotFoundError("User", str(user_id))

    async def count_users(self, clinic_id: uuid.UUID) -> int:
        return await self.repo.count(clinic_id=clinic_id)
