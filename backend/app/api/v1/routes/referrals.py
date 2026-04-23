from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.referral import DoctorReferral, ReferralStatus, ReferralPriority

router = APIRouter(prefix="/referrals", tags=["Referrals"])


# ---------- schemas ----------

class CreateReferralRequest(BaseModel):
    patient_id: uuid.UUID
    to_doctor_id: uuid.UUID | None = None
    to_specialty: str
    priority: ReferralPriority = ReferralPriority.ROUTINE
    reason: str
    diagnosis: str | None = None
    notes: str | None = None


class DeclineRequest(BaseModel):
    response_notes: str


class CompleteRequest(BaseModel):
    response_notes: str | None = None


# ---------- helpers ----------

def _referral_to_dict(r: DoctorReferral) -> dict:
    return {
        "id": str(r.id),
        "patient_id": str(r.patient_id),
        "from_doctor_id": str(r.from_doctor_id),
        "to_doctor_id": str(r.to_doctor_id) if r.to_doctor_id else None,
        "to_specialty": r.to_specialty,
        "priority": r.priority.value if hasattr(r.priority, "value") else str(r.priority),
        "status": r.status.value if hasattr(r.status, "value") else str(r.status),
        "reason": r.reason,
        "diagnosis": r.diagnosis,
        "notes": r.notes,
        "response_notes": r.response_notes,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


# ---------- endpoints ----------

@router.post("/")
async def create_referral(
    body: CreateReferralRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new doctor referral."""
    referral = DoctorReferral(
        clinic_id=current_user.clinic_id,
        patient_id=body.patient_id,
        from_doctor_id=current_user.id,
        to_doctor_id=body.to_doctor_id,
        to_specialty=body.to_specialty,
        priority=body.priority,
        status=ReferralStatus.PENDING,
        reason=body.reason,
        diagnosis=body.diagnosis,
        notes=body.notes,
    )
    session.add(referral)
    await session.commit()
    await session.refresh(referral)
    return _referral_to_dict(referral)


@router.get("/")
async def list_referrals(
    session: DBSession,
    current_user: CurrentUser,
    from_doctor: uuid.UUID | None = None,
    to_doctor: uuid.UUID | None = None,
    status: ReferralStatus | None = None,
    priority: ReferralPriority | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List referrals with filters."""
    q = (
        select(DoctorReferral)
        .where(
            DoctorReferral.clinic_id == current_user.clinic_id,
            DoctorReferral.is_deleted == False,
        )
    )
    if from_doctor:
        q = q.where(DoctorReferral.from_doctor_id == from_doctor)
    if to_doctor:
        q = q.where(DoctorReferral.to_doctor_id == to_doctor)
    if status:
        q = q.where(DoctorReferral.status == status)
    if priority:
        q = q.where(DoctorReferral.priority == priority)

    q = q.order_by(DoctorReferral.created_at.desc()).limit(limit).offset(offset)

    result = await session.execute(q)
    referrals = result.scalars().all()
    return [_referral_to_dict(r) for r in referrals]


@router.get("/incoming")
async def my_incoming_referrals(
    session: DBSession,
    current_user: CurrentUser,
    status: ReferralStatus | None = None,
):
    """Get referrals sent TO the current doctor."""
    q = (
        select(DoctorReferral)
        .where(
            DoctorReferral.clinic_id == current_user.clinic_id,
            DoctorReferral.to_doctor_id == current_user.id,
            DoctorReferral.is_deleted == False,
        )
    )
    if status:
        q = q.where(DoctorReferral.status == status)
    q = q.order_by(DoctorReferral.created_at.desc())

    result = await session.execute(q)
    return [_referral_to_dict(r) for r in result.scalars().all()]


@router.get("/outgoing")
async def my_outgoing_referrals(
    session: DBSession,
    current_user: CurrentUser,
    status: ReferralStatus | None = None,
):
    """Get referrals sent BY the current doctor."""
    q = (
        select(DoctorReferral)
        .where(
            DoctorReferral.clinic_id == current_user.clinic_id,
            DoctorReferral.from_doctor_id == current_user.id,
            DoctorReferral.is_deleted == False,
        )
    )
    if status:
        q = q.where(DoctorReferral.status == status)
    q = q.order_by(DoctorReferral.created_at.desc())

    result = await session.execute(q)
    return [_referral_to_dict(r) for r in result.scalars().all()]


@router.get("/{referral_id}")
async def get_referral(
    referral_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get referral detail."""
    result = await session.execute(
        select(DoctorReferral).where(
            DoctorReferral.id == referral_id,
            DoctorReferral.is_deleted == False,
        )
    )
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return _referral_to_dict(referral)


@router.patch("/{referral_id}/accept")
async def accept_referral(
    referral_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Accept an incoming referral."""
    result = await session.execute(
        select(DoctorReferral).where(
            DoctorReferral.id == referral_id,
            DoctorReferral.is_deleted == False,
        )
    )
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    if referral.status != ReferralStatus.PENDING:
        raise HTTPException(status_code=400, detail="Referral is not in pending status")

    referral.status = ReferralStatus.ACCEPTED
    referral.to_doctor_id = current_user.id
    await session.commit()
    await session.refresh(referral)
    return _referral_to_dict(referral)


@router.patch("/{referral_id}/decline")
async def decline_referral(
    referral_id: uuid.UUID,
    body: DeclineRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Decline a referral with a reason."""
    result = await session.execute(
        select(DoctorReferral).where(
            DoctorReferral.id == referral_id,
            DoctorReferral.is_deleted == False,
        )
    )
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    if referral.status != ReferralStatus.PENDING:
        raise HTTPException(status_code=400, detail="Referral is not in pending status")

    referral.status = ReferralStatus.DECLINED
    referral.response_notes = body.response_notes
    await session.commit()
    await session.refresh(referral)
    return _referral_to_dict(referral)


@router.patch("/{referral_id}/complete")
async def complete_referral(
    referral_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    body: CompleteRequest | None = None,
):
    """Mark a referral as completed."""
    result = await session.execute(
        select(DoctorReferral).where(
            DoctorReferral.id == referral_id,
            DoctorReferral.is_deleted == False,
        )
    )
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    if referral.status != ReferralStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Referral must be accepted before completing")

    referral.status = ReferralStatus.COMPLETED
    if body and body.response_notes:
        referral.response_notes = body.response_notes
    await session.commit()
    await session.refresh(referral)
    return _referral_to_dict(referral)
