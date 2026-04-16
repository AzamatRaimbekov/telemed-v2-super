from __future__ import annotations
import uuid
from fastapi import APIRouter, Query
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=list[UserOut])
async def list_users(session: DBSession, current_user: CurrentUser, skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), role: UserRole | None = None, _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)):
    service = UserService(session)
    return await service.list_users(current_user.clinic_id, skip, limit, role.value if role else None)

@router.post("", response_model=UserOut, status_code=201)
async def create_user(data: UserCreate, session: DBSession, current_user: CurrentUser, _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)):
    service = UserService(session)
    return await service.create_user(data, current_user.clinic_id)

@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = UserService(session)
    return await service.get_user(user_id, current_user.clinic_id)

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: uuid.UUID, data: UserUpdate, session: DBSession, current_user: CurrentUser, _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)):
    service = UserService(session)
    return await service.update_user(user_id, data, current_user.clinic_id)

@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, session: DBSession, current_user: CurrentUser, _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)):
    service = UserService(session)
    await service.delete_user(user_id, current_user.clinic_id)
