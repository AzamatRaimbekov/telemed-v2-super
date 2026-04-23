from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.consumables import ConsumableItem, ConsumableUsage, ConsumableCategory
from app.models.user import User

router = APIRouter(prefix="/consumables", tags=["Consumables / Расходники"])


# ---------- schemas ----------

class ItemCreate(BaseModel):
    name: str
    sku: str
    category: ConsumableCategory = ConsumableCategory.OTHER
    unit: str = "шт"
    quantity: int = 0
    min_quantity: int = 10
    unit_price: float = 0
    supplier: str | None = None
    expiry_date: date | None = None
    location: str | None = None
    notes: str | None = None


class ItemUpdate(BaseModel):
    name: str | None = None
    category: ConsumableCategory | None = None
    unit: str | None = None
    quantity: int | None = None
    min_quantity: int | None = None
    unit_price: float | None = None
    supplier: str | None = None
    expiry_date: date | None = None
    location: str | None = None
    notes: str | None = None


class UseCreate(BaseModel):
    item_id: uuid.UUID
    quantity_used: int
    patient_id: uuid.UUID | None = None
    department: str | None = None
    reason: str | None = None


# ---------- helpers ----------

def _item_to_dict(item: ConsumableItem) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "sku": item.sku,
        "category": item.category.value if isinstance(item.category, ConsumableCategory) else item.category,
        "unit": item.unit,
        "quantity": item.quantity,
        "min_quantity": item.min_quantity,
        "unit_price": item.unit_price,
        "supplier": item.supplier,
        "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
        "location": item.location,
        "notes": item.notes,
        "is_low_stock": item.quantity < item.min_quantity,
        "created_at": item.created_at.isoformat(),
    }


def _usage_to_dict(u: ConsumableUsage, user_name: str | None = None) -> dict:
    return {
        "id": str(u.id),
        "item_id": str(u.item_id),
        "used_by_id": str(u.used_by_id),
        "used_by_name": user_name,
        "patient_id": str(u.patient_id) if u.patient_id else None,
        "quantity_used": u.quantity_used,
        "department": u.department,
        "reason": u.reason,
        "created_at": u.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.get("/categories")
async def list_categories(current_user: CurrentUser):
    """List all consumable categories."""
    return [{"value": c.value, "label": c.value} for c in ConsumableCategory]


@router.get("/items")
async def list_items(
    session: DBSession,
    current_user: CurrentUser,
    category: ConsumableCategory | None = None,
    search: str | None = None,
):
    """List all consumable items."""
    q = select(ConsumableItem).where(
        ConsumableItem.clinic_id == current_user.clinic_id,
        ConsumableItem.is_deleted == False,
    )
    if category:
        q = q.where(ConsumableItem.category == category)
    if search:
        q = q.where(ConsumableItem.name.ilike(f"%{search}%"))
    q = q.order_by(ConsumableItem.name)
    result = await session.execute(q)
    return [_item_to_dict(i) for i in result.scalars().all()]


@router.post("/items", status_code=201)
async def create_item(
    data: ItemCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a consumable item."""
    item = ConsumableItem(
        clinic_id=current_user.clinic_id,
        name=data.name,
        sku=data.sku,
        category=data.category,
        unit=data.unit,
        quantity=data.quantity,
        min_quantity=data.min_quantity,
        unit_price=data.unit_price,
        supplier=data.supplier,
        expiry_date=data.expiry_date,
        location=data.location,
        notes=data.notes,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return _item_to_dict(item)


@router.put("/items/{item_id}")
async def update_item(
    item_id: uuid.UUID,
    data: ItemUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a consumable item."""
    result = await session.execute(
        select(ConsumableItem).where(
            ConsumableItem.id == item_id,
            ConsumableItem.clinic_id == current_user.clinic_id,
            ConsumableItem.is_deleted == False,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return {"error": "Item not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    return _item_to_dict(item)


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a consumable item."""
    result = await session.execute(
        select(ConsumableItem).where(
            ConsumableItem.id == item_id,
            ConsumableItem.clinic_id == current_user.clinic_id,
            ConsumableItem.is_deleted == False,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return {"error": "Item not found"}
    item.is_deleted = True
    await session.commit()
    return {"status": "deleted"}


@router.post("/use", status_code=201)
async def use_consumable(
    data: UseCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Record consumable usage (deducts quantity from stock)."""
    result = await session.execute(
        select(ConsumableItem).where(
            ConsumableItem.id == data.item_id,
            ConsumableItem.clinic_id == current_user.clinic_id,
            ConsumableItem.is_deleted == False,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return {"error": "Item not found"}
    if item.quantity < data.quantity_used:
        return {"error": f"Insufficient stock. Available: {item.quantity}"}
    item.quantity -= data.quantity_used
    usage = ConsumableUsage(
        clinic_id=current_user.clinic_id,
        item_id=data.item_id,
        used_by_id=current_user.id,
        patient_id=data.patient_id,
        quantity_used=data.quantity_used,
        department=data.department,
        reason=data.reason,
    )
    session.add(usage)
    await session.commit()
    await session.refresh(usage)
    return {
        "usage": _usage_to_dict(usage),
        "remaining_quantity": item.quantity,
    }


@router.get("/low-stock")
async def low_stock_items(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get items below minimum quantity threshold."""
    result = await session.execute(
        select(ConsumableItem).where(
            ConsumableItem.clinic_id == current_user.clinic_id,
            ConsumableItem.is_deleted == False,
            ConsumableItem.quantity < ConsumableItem.min_quantity,
        ).order_by(ConsumableItem.quantity)
    )
    return [_item_to_dict(i) for i in result.scalars().all()]


@router.get("/expiring")
async def expiring_items(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(30, description="Days until expiry"),
):
    """Get items expiring within N days (default 30)."""
    cutoff = date.today() + timedelta(days=days)
    result = await session.execute(
        select(ConsumableItem).where(
            ConsumableItem.clinic_id == current_user.clinic_id,
            ConsumableItem.is_deleted == False,
            ConsumableItem.expiry_date != None,
            ConsumableItem.expiry_date <= cutoff,
        ).order_by(ConsumableItem.expiry_date)
    )
    return [_item_to_dict(i) for i in result.scalars().all()]


@router.get("/usage-report")
async def usage_report(
    session: DBSession,
    current_user: CurrentUser,
    days: int = Query(30, description="Period in days"),
):
    """Usage statistics by department and item for the last N days."""
    since = date.today() - timedelta(days=days)

    # By department
    dept_result = await session.execute(
        select(
            ConsumableUsage.department,
            func.sum(ConsumableUsage.quantity_used).label("total_used"),
            func.count().label("usage_count"),
        ).where(
            ConsumableUsage.clinic_id == current_user.clinic_id,
            ConsumableUsage.is_deleted == False,
            ConsumableUsage.created_at >= since,
        ).group_by(ConsumableUsage.department)
    )
    by_department = [
        {"department": row.department or "Не указан", "total_used": row.total_used, "usage_count": row.usage_count}
        for row in dept_result.all()
    ]

    # By item (top 20)
    item_result = await session.execute(
        select(
            ConsumableUsage.item_id,
            ConsumableItem.name,
            func.sum(ConsumableUsage.quantity_used).label("total_used"),
        ).join(ConsumableItem, ConsumableItem.id == ConsumableUsage.item_id).where(
            ConsumableUsage.clinic_id == current_user.clinic_id,
            ConsumableUsage.is_deleted == False,
            ConsumableUsage.created_at >= since,
        ).group_by(ConsumableUsage.item_id, ConsumableItem.name)
        .order_by(func.sum(ConsumableUsage.quantity_used).desc())
        .limit(20)
    )
    by_item = [
        {"item_id": str(row.item_id), "name": row.name, "total_used": row.total_used}
        for row in item_result.all()
    ]

    return {
        "period_days": days,
        "by_department": by_department,
        "by_item": by_item,
    }
