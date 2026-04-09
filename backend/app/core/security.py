import uuid
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, role: str, clinic_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "role": role, "clinic_id": clinic_id, "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES), "iat": now, "jti": str(uuid.uuid4()), "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: str, role: str, clinic_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "role": role, "clinic_id": clinic_id, "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS), "iat": now, "jti": str(uuid.uuid4()), "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
