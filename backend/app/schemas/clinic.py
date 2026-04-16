from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.clinic import SubscriptionPlan

class ClinicCreate(BaseModel):
    name: str
    slug: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None

class ClinicUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None
    is_active: bool | None = None
    settings: dict | None = None

class ClinicOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    working_hours: dict | None = None
    subscription_plan: SubscriptionPlan
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
