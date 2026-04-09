from fastapi import APIRouter, Request
from app.api.deps import CurrentUser, DBSession, RedisClient
from app.core.security import decode_token
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserOut
from app.services.auth import AuthService
from datetime import datetime, timezone

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: DBSession, redis: RedisClient):
    service = AuthService(session, redis)
    return await service.login(data.email, data.password)

@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, session: DBSession, redis: RedisClient):
    service = AuthService(session, redis)
    return await service.refresh(data.refresh_token)

@router.post("/logout")
async def logout(request: Request, current_user: CurrentUser, redis: RedisClient):
    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.replace("Bearer ", "") if auth_header else ""
    try:
        payload = decode_token(access_token)
        jti = payload.get("jti")
        ttl = payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await redis.setex(f"blacklist:{jti}", ttl, "1")
    except ValueError:
        pass
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return current_user
