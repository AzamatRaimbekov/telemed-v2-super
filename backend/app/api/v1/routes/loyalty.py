from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.core.database import get_session
from app.core.redis import get_redis
from app.core.security import decode_token
from app.core.exceptions import AuthenticationError
from app.models.patient import Patient
from app.services.loyalty_service import LoyaltyService
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from typing import Annotated

router = APIRouter(prefix="/loyalty", tags=["Loyalty / Bonus"])

security = HTTPBearer()


# Portal patient auth (same as portal.py pattern)
async def get_portal_patient(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> Patient:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise AuthenticationError("Invalid token")
    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")
    jti = payload.get("jti")
    if await redis.get(f"blacklist:{jti}"):
        raise AuthenticationError("Token revoked")
    patient_id = payload.get("sub")
    result = await session.execute(
        select(Patient).where(Patient.id == uuid.UUID(patient_id), Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise AuthenticationError("Patient not found")
    return patient


PortalPatient = Annotated[Patient, Depends(get_portal_patient)]
PortalDBSession = Annotated[AsyncSession, Depends(get_session)]


# ---------- schemas ----------

class EarnRequest(BaseModel):
    patient_id: uuid.UUID
    amount: int
    description: str
    reference_id: uuid.UUID | None = None


class SpendRequest(BaseModel):
    amount: int
    description: str


# ---------- portal endpoints ----------

@router.get("/balance")
async def get_balance(patient: PortalPatient, session: PortalDBSession):
    service = LoyaltyService(session)
    return await service.get_balance(patient.id, patient.clinic_id)


@router.get("/history")
async def get_history(
    patient: PortalPatient,
    session: PortalDBSession,
    limit: int = Query(50, ge=1, le=200),
):
    service = LoyaltyService(session)
    return await service.get_history(patient.id, patient.clinic_id, limit=limit)


# ---------- admin endpoints ----------

@router.post("/earn")
async def earn_points(
    data: EarnRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    service = LoyaltyService(session)
    txn = await service.earn_points(
        patient_id=data.patient_id,
        clinic_id=current_user.clinic_id,
        amount=data.amount,
        description=data.description,
        reference_id=data.reference_id,
    )
    return {"ok": True, "transaction_id": str(txn.id)}


@router.post("/spend")
async def spend_points(
    data: SpendRequest,
    patient: PortalPatient,
    session: PortalDBSession,
):
    service = LoyaltyService(session)
    txn = await service.spend_points(
        patient_id=patient.id,
        clinic_id=patient.clinic_id,
        amount=data.amount,
        description=data.description,
    )
    return {"ok": True, "transaction_id": str(txn.id)}
