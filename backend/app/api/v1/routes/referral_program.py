from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from app.api.deps import DBSession
from app.models.referral_program import ReferralCode, ReferralUse
import uuid
import random
import string

router = APIRouter(prefix="/referral", tags=["Referral Program"])


class UseCodeRequest(BaseModel):
    code: str
    patient_id: str


def _generate_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "MED-" + "".join(random.choices(chars, k=length))


@router.get("/my-code")
async def my_code(session: DBSession, patient_id: str = None, clinic_id: str = None):
    """Get or create referral code for patient."""
    if not patient_id:
        raise HTTPException(400, "patient_id is required")

    pid = uuid.UUID(patient_id)
    result = await session.execute(
        select(ReferralCode).where(ReferralCode.patient_id == pid)
    )
    code = result.scalar_one_or_none()

    if not code:
        code = ReferralCode(
            patient_id=pid,
            code=_generate_code(),
            clinic_id=uuid.UUID(clinic_id) if clinic_id else uuid.uuid4(),
            discount_percent=10,
            referrer_bonus_percent=5,
        )
        session.add(code)
        await session.commit()
        await session.refresh(code)

    return {
        "code": code.code,
        "discount_percent": code.discount_percent,
        "referrer_bonus_percent": code.referrer_bonus_percent,
        "uses_count": code.uses_count,
        "max_uses": code.max_uses,
        "is_active": code.is_active,
    }


@router.post("/use")
async def use_code(session: DBSession, body: UseCodeRequest):
    """Use a referral code."""
    result = await session.execute(
        select(ReferralCode).where(and_(
            ReferralCode.code == body.code,
            ReferralCode.is_active == True,
        ))
    )
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(404, "Код не найден или неактивен")

    pid = uuid.UUID(body.patient_id)
    if code.patient_id == pid:
        raise HTTPException(400, "Нельзя использовать свой собственный код")

    if code.max_uses and code.uses_count >= code.max_uses:
        raise HTTPException(400, "Код достиг максимального числа использований")

    # Check if already used by this patient
    existing = await session.execute(
        select(ReferralUse).where(and_(
            ReferralUse.code_id == code.id,
            ReferralUse.referred_patient_id == pid,
        ))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Вы уже использовали этот код")

    use = ReferralUse(
        code_id=code.id,
        referred_patient_id=pid,
        clinic_id=code.clinic_id,
        discount_amount=code.discount_percent,
        bonus_amount=code.referrer_bonus_percent,
    )
    code.uses_count += 1
    session.add(use)
    await session.commit()

    return {
        "status": "success",
        "discount_percent": code.discount_percent,
        "message": f"Скидка {code.discount_percent}% применена!"
    }


@router.get("/my-referrals")
async def my_referrals(session: DBSession, patient_id: str = None):
    """List who used my referral code."""
    if not patient_id:
        return []

    pid = uuid.UUID(patient_id)
    result = await session.execute(
        select(ReferralCode).where(ReferralCode.patient_id == pid)
    )
    code = result.scalar_one_or_none()
    if not code:
        return []

    uses_result = await session.execute(
        select(ReferralUse).where(ReferralUse.code_id == code.id)
    )
    uses = uses_result.scalars().all()
    return [
        {
            "id": str(u.id),
            "referred_patient_id": str(u.referred_patient_id),
            "discount_amount": u.discount_amount,
            "bonus_amount": u.bonus_amount,
            "date": u.created_at.isoformat(),
        } for u in uses
    ]


@router.get("/my-bonuses")
async def my_bonuses(session: DBSession, patient_id: str = None):
    """Total earned bonuses from referrals."""
    if not patient_id:
        return {"total_bonus": 0, "referrals_count": 0}

    pid = uuid.UUID(patient_id)
    result = await session.execute(
        select(ReferralCode).where(ReferralCode.patient_id == pid)
    )
    code = result.scalar_one_or_none()
    if not code:
        return {"total_bonus": 0, "referrals_count": 0}

    bonus_result = await session.execute(
        select(func.sum(ReferralUse.bonus_amount), func.count(ReferralUse.id)).where(
            ReferralUse.code_id == code.id
        )
    )
    row = bonus_result.one()
    return {
        "total_bonus": row[0] or 0,
        "referrals_count": row[1] or 0,
        "code": code.code,
    }
