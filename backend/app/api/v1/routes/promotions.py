from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.promotions import Promotion, DiscountType

router = APIRouter(prefix="/promotions", tags=["Promotions / Скидки и акции"])


# ---------- schemas ----------

class PromoCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    discount_type: DiscountType
    discount_value: float
    min_amount: float = 0
    max_uses: int | None = None
    valid_from: date
    valid_until: date
    applicable_services: dict | None = None
    is_active: bool = True


class PromoUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    discount_type: DiscountType | None = None
    discount_value: float | None = None
    min_amount: float | None = None
    max_uses: int | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    applicable_services: dict | None = None
    is_active: bool | None = None


class ValidateRequest(BaseModel):
    code: str
    amount: float


# ---------- helpers ----------

def _promo_to_dict(p: Promotion) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "code": p.code,
        "description": p.description,
        "discount_type": p.discount_type.value if isinstance(p.discount_type, DiscountType) else p.discount_type,
        "discount_value": p.discount_value,
        "min_amount": p.min_amount,
        "max_uses": p.max_uses,
        "used_count": p.used_count,
        "valid_from": p.valid_from.isoformat(),
        "valid_until": p.valid_until.isoformat(),
        "applicable_services": p.applicable_services,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.get("")
async def list_promotions(
    session: DBSession,
    current_user: CurrentUser,
    active_only: bool = False,
):
    """List all promotions."""
    q = select(Promotion).where(
        Promotion.clinic_id == current_user.clinic_id,
        Promotion.is_deleted == False,
    )
    if active_only:
        q = q.where(Promotion.is_active == True)
    q = q.order_by(Promotion.created_at.desc())
    result = await session.execute(q)
    return [_promo_to_dict(p) for p in result.scalars().all()]


@router.post("", status_code=201)
async def create_promotion(
    data: PromoCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new promotion."""
    promo = Promotion(
        clinic_id=current_user.clinic_id,
        name=data.name,
        code=data.code,
        description=data.description,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        min_amount=data.min_amount,
        max_uses=data.max_uses,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        applicable_services=data.applicable_services,
        is_active=data.is_active,
    )
    session.add(promo)
    await session.commit()
    await session.refresh(promo)
    return _promo_to_dict(promo)


@router.put("/{promo_id}")
async def update_promotion(
    promo_id: uuid.UUID,
    data: PromoUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a promotion."""
    result = await session.execute(
        select(Promotion).where(
            Promotion.id == promo_id,
            Promotion.clinic_id == current_user.clinic_id,
            Promotion.is_deleted == False,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        return {"error": "Promotion not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(promo, field, value)
    await session.commit()
    await session.refresh(promo)
    return _promo_to_dict(promo)


@router.delete("/{promo_id}")
async def delete_promotion(
    promo_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a promotion."""
    result = await session.execute(
        select(Promotion).where(
            Promotion.id == promo_id,
            Promotion.clinic_id == current_user.clinic_id,
            Promotion.is_deleted == False,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        return {"error": "Promotion not found"}
    promo.is_deleted = True
    await session.commit()
    return {"status": "deleted"}


@router.post("/validate")
async def validate_promo_code(
    data: ValidateRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Validate a promo code and calculate discount."""
    today = date.today()
    result = await session.execute(
        select(Promotion).where(
            Promotion.clinic_id == current_user.clinic_id,
            Promotion.code == data.code,
            Promotion.is_deleted == False,
            Promotion.is_active == True,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        return {"valid": False, "reason": "Промокод не найден"}
    if today < promo.valid_from or today > promo.valid_until:
        return {"valid": False, "reason": "Промокод просрочен"}
    if promo.max_uses and promo.used_count >= promo.max_uses:
        return {"valid": False, "reason": "Лимит использований исчерпан"}
    if data.amount < promo.min_amount:
        return {"valid": False, "reason": f"Минимальная сумма: {promo.min_amount} сом"}

    if promo.discount_type == DiscountType.PERCENT:
        discount = round(data.amount * promo.discount_value / 100, 2)
    else:
        discount = promo.discount_value

    final_amount = max(0, round(data.amount - discount, 2))
    return {
        "valid": True,
        "promotion": _promo_to_dict(promo),
        "original_amount": data.amount,
        "discount": discount,
        "final_amount": final_amount,
    }


@router.get("/active")
async def active_promotions(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get currently active promotions (valid date range and is_active)."""
    today = date.today()
    result = await session.execute(
        select(Promotion).where(
            Promotion.clinic_id == current_user.clinic_id,
            Promotion.is_deleted == False,
            Promotion.is_active == True,
            Promotion.valid_from <= today,
            Promotion.valid_until >= today,
        ).order_by(Promotion.valid_until)
    )
    return [_promo_to_dict(p) for p in result.scalars().all()]
