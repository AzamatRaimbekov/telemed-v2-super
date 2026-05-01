from __future__ import annotations
import uuid
from datetime import datetime, timezone
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import TokenResponse

class AuthService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self.user_repo = UserRepository(session)
        self.redis = redis
        self.session = session

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self.user_repo.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is deactivated")
        clinic_id = str(user.clinic_id) if user.clinic_id else None
        access_token = create_access_token(str(user.id), user.role.value, clinic_id)
        refresh_token = create_refresh_token(str(user.id), user.role.value, clinic_id)
        try:
            user.last_login_at = datetime.now(timezone.utc)
            await self.session.flush()
        except Exception:
            await self.session.rollback()
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise AuthenticationError("Invalid refresh token")
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")
        jti = payload.get("jti")
        is_blacklisted = await self.redis.get(f"blacklist:{jti}")
        if is_blacklisted:
            raise AuthenticationError("Token has been revoked")
        user_id = payload.get("sub")
        user = await self.user_repo.get_by_id(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise AuthenticationError("User not found or deactivated")
        ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await self.redis.setex(f"blacklist:{jti}", ttl, "1")
        clinic_id = str(user.clinic_id) if user.clinic_id else None
        new_access = create_access_token(str(user.id), user.role.value, clinic_id)
        new_refresh = create_refresh_token(str(user.id), user.role.value, clinic_id)
        return TokenResponse(access_token=new_access, refresh_token=new_refresh)

    async def logout(self, access_token: str, refresh_token: str | None = None) -> None:
        try:
            payload = decode_token(access_token)
            jti = payload.get("jti")
            ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
            if ttl > 0:
                await self.redis.setex(f"blacklist:{jti}", ttl, "1")
        except ValueError:
            pass
        if refresh_token:
            try:
                payload = decode_token(refresh_token)
                jti = payload.get("jti")
                ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
                if ttl > 0:
                    await self.redis.setex(f"blacklist:{jti}", ttl, "1")
            except ValueError:
                pass
