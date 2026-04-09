import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    phone: str | None = None
    role: UserRole
    specialization: str | None = None
    department_id: uuid.UUID | None = None

class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    phone: str | None = None
    specialization: str | None = None
    department_id: uuid.UUID | None = None
    is_active: bool | None = None

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    phone: str | None = None
    role: UserRole
    avatar_url: str | None = None
    specialization: str | None = None
    department_id: uuid.UUID | None = None
    clinic_id: uuid.UUID | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
