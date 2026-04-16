from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.exceptions import AuthenticationError, ForbiddenError
from app.core.redis import get_redis
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

security_scheme = HTTPBearer()
DBSession = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]

async def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)], session: DBSession, redis: RedisClient) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise AuthenticationError("Invalid or expired token")
    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")
    jti = payload.get("jti")
    is_blacklisted = await redis.get(f"blacklist:{jti}")
    if is_blacklisted:
        raise AuthenticationError("Token has been revoked")
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload")
    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or deactivated")
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]

def require_role(*roles: UserRole):
    async def role_checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(f"Role {current_user.role.value} does not have access")
        return current_user
    return Depends(role_checker)
