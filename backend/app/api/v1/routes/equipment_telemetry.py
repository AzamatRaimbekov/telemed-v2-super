from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.equipment_telemetry import (
    MedicalEquipment, EquipmentReading, EquipmentType, EquipmentStatus,
)

router = APIRouter(prefix="/equipment", tags=["Equipment Telemetry / Телеметрия"])


# ---------- schemas ----------

class EquipmentCreate(BaseModel):
    name: str
    serial_number: str
    equipment_type: EquipmentType
    manufacturer: str | None = None
    model: str | None = None
    location: str | None = None
    room_id: uuid.UUID | None = None
    next_maintenance: datetime | None = None


class EquipmentUpdate(BaseModel):
    name: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    location: str | None = None
    room_id: uuid.UUID | None = None
    next_maintenance: datetime | None = None
    hours_used: int | None = None
    is_connected: bool | None = None


class StatusUpdate(BaseModel):
    status: EquipmentStatus


class ReadingCreate(BaseModel):
    reading_type: str
    value: float | None = None
    unit: str | None = None
    string_value: str | None = None
    is_alert: bool = False
    metadata_json: dict | None = None


# ---------- helpers ----------

def _equip_to_dict(e: MedicalEquipment) -> dict:
    return {
        "id": str(e.id),
        "name": e.name,
        "serial_number": e.serial_number,
        "equipment_type": e.equipment_type.value if isinstance(e.equipment_type, EquipmentType) else e.equipment_type,
        "manufacturer": e.manufacturer,
        "model": e.model,
        "location": e.location,
        "room_id": str(e.room_id) if e.room_id else None,
        "status": e.status.value if isinstance(e.status, EquipmentStatus) else e.status,
        "last_maintenance": e.last_maintenance.isoformat() if e.last_maintenance else None,
        "next_maintenance": e.next_maintenance.isoformat() if e.next_maintenance else None,
        "hours_used": e.hours_used,
        "is_connected": e.is_connected,
        "created_at": e.created_at.isoformat(),
    }


def _reading_to_dict(r: EquipmentReading) -> dict:
    return {
        "id": str(r.id),
        "equipment_id": str(r.equipment_id),
        "reading_type": r.reading_type,
        "value": r.value,
        "unit": r.unit,
        "string_value": r.string_value,
        "is_alert": r.is_alert,
        "metadata_json": r.metadata_json,
        "created_at": r.created_at.isoformat(),
    }


# ---------- equipment CRUD ----------

@router.get("/")
async def list_equipment(
    session: DBSession,
    current_user: CurrentUser,
    equipment_type: EquipmentType | None = None,
    status: EquipmentStatus | None = None,
    search: str | None = None,
):
    """List all medical equipment."""
    q = select(MedicalEquipment).where(
        MedicalEquipment.clinic_id == current_user.clinic_id,
        MedicalEquipment.is_deleted == False,
    )
    if equipment_type:
        q = q.where(MedicalEquipment.equipment_type == equipment_type)
    if status:
        q = q.where(MedicalEquipment.status == status)
    if search:
        q = q.where(MedicalEquipment.name.ilike(f"%{search}%"))
    q = q.order_by(MedicalEquipment.name)
    result = await session.execute(q)
    return [_equip_to_dict(e) for e in result.scalars().all()]


@router.post("/", status_code=201)
async def create_equipment(
    data: EquipmentCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Register new medical equipment."""
    equip = MedicalEquipment(
        clinic_id=current_user.clinic_id,
        name=data.name,
        serial_number=data.serial_number,
        equipment_type=data.equipment_type,
        manufacturer=data.manufacturer,
        model=data.model,
        location=data.location,
        room_id=data.room_id,
        status=EquipmentStatus.OPERATIONAL,
        next_maintenance=data.next_maintenance,
        hours_used=0,
        is_connected=False,
    )
    session.add(equip)
    await session.commit()
    await session.refresh(equip)
    return _equip_to_dict(equip)


@router.put("/{equipment_id}")
async def update_equipment(
    equipment_id: uuid.UUID,
    data: EquipmentUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update equipment details."""
    result = await session.execute(
        select(MedicalEquipment).where(
            MedicalEquipment.id == equipment_id,
            MedicalEquipment.clinic_id == current_user.clinic_id,
            MedicalEquipment.is_deleted == False,
        )
    )
    equip = result.scalar_one_or_none()
    if not equip:
        return {"error": "Equipment not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(equip, field, value)
    await session.commit()
    await session.refresh(equip)
    return _equip_to_dict(equip)


@router.patch("/{equipment_id}/status")
async def update_status(
    equipment_id: uuid.UUID,
    data: StatusUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update equipment status."""
    result = await session.execute(
        select(MedicalEquipment).where(
            MedicalEquipment.id == equipment_id,
            MedicalEquipment.clinic_id == current_user.clinic_id,
            MedicalEquipment.is_deleted == False,
        )
    )
    equip = result.scalar_one_or_none()
    if not equip:
        return {"error": "Equipment not found"}
    equip.status = data.status
    if data.status == EquipmentStatus.MAINTENANCE:
        equip.last_maintenance = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(equip)
    return _equip_to_dict(equip)


# ---------- readings / telemetry ----------

@router.post("/{equipment_id}/reading", status_code=201)
async def submit_reading(
    equipment_id: uuid.UUID,
    data: ReadingCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Submit a telemetry reading for equipment."""
    # Verify equipment exists
    result = await session.execute(
        select(MedicalEquipment).where(
            MedicalEquipment.id == equipment_id,
            MedicalEquipment.clinic_id == current_user.clinic_id,
            MedicalEquipment.is_deleted == False,
        )
    )
    equip = result.scalar_one_or_none()
    if not equip:
        return {"error": "Equipment not found"}

    reading = EquipmentReading(
        clinic_id=current_user.clinic_id,
        equipment_id=equipment_id,
        reading_type=data.reading_type,
        value=data.value,
        unit=data.unit,
        string_value=data.string_value,
        is_alert=data.is_alert,
        metadata_json=data.metadata_json,
    )
    session.add(reading)
    # Mark equipment as connected
    equip.is_connected = True
    await session.commit()
    await session.refresh(reading)
    return _reading_to_dict(reading)


@router.get("/{equipment_id}/readings")
async def get_readings(
    equipment_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    limit: int = Query(50, le=200),
    reading_type: str | None = None,
):
    """Get recent readings for equipment."""
    q = select(EquipmentReading).where(
        EquipmentReading.equipment_id == equipment_id,
        EquipmentReading.clinic_id == current_user.clinic_id,
        EquipmentReading.is_deleted == False,
    )
    if reading_type:
        q = q.where(EquipmentReading.reading_type == reading_type)
    q = q.order_by(EquipmentReading.created_at.desc()).limit(limit)
    result = await session.execute(q)
    return [_reading_to_dict(r) for r in result.scalars().all()]


@router.get("/alerts")
async def get_alerts(
    session: DBSession,
    current_user: CurrentUser,
    hours: int = Query(24, description="Lookback period in hours"),
):
    """Get active alert readings."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await session.execute(
        select(EquipmentReading).where(
            EquipmentReading.clinic_id == current_user.clinic_id,
            EquipmentReading.is_deleted == False,
            EquipmentReading.is_alert == True,
            EquipmentReading.created_at >= since,
        ).order_by(EquipmentReading.created_at.desc())
    )
    return [_reading_to_dict(r) for r in result.scalars().all()]


@router.get("/maintenance-due")
async def maintenance_due(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get equipment needing maintenance (past or within 7 days)."""
    cutoff = datetime.now(timezone.utc) + timedelta(days=7)
    result = await session.execute(
        select(MedicalEquipment).where(
            MedicalEquipment.clinic_id == current_user.clinic_id,
            MedicalEquipment.is_deleted == False,
            MedicalEquipment.next_maintenance != None,
            MedicalEquipment.next_maintenance <= cutoff,
            MedicalEquipment.status != EquipmentStatus.DECOMMISSIONED,
        ).order_by(MedicalEquipment.next_maintenance)
    )
    return [_equip_to_dict(e) for e in result.scalars().all()]


@router.get("/dashboard")
async def equipment_dashboard(
    session: DBSession,
    current_user: CurrentUser,
):
    """Overview stats for equipment."""
    clinic_id = current_user.clinic_id

    # Total by status
    status_result = await session.execute(
        select(
            MedicalEquipment.status,
            func.count().label("count"),
        ).where(
            MedicalEquipment.clinic_id == clinic_id,
            MedicalEquipment.is_deleted == False,
        ).group_by(MedicalEquipment.status)
    )
    by_status = {row.status.value if isinstance(row.status, EquipmentStatus) else row.status: row.count for row in status_result.all()}

    # Total by type
    type_result = await session.execute(
        select(
            MedicalEquipment.equipment_type,
            func.count().label("count"),
        ).where(
            MedicalEquipment.clinic_id == clinic_id,
            MedicalEquipment.is_deleted == False,
        ).group_by(MedicalEquipment.equipment_type)
    )
    by_type = {row.equipment_type.value if isinstance(row.equipment_type, EquipmentType) else row.equipment_type: row.count for row in type_result.all()}

    # Connected count
    connected_result = await session.execute(
        select(func.count()).where(
            MedicalEquipment.clinic_id == clinic_id,
            MedicalEquipment.is_deleted == False,
            MedicalEquipment.is_connected == True,
        )
    )
    connected_count = connected_result.scalar() or 0

    # Recent alerts (24h)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    alert_result = await session.execute(
        select(func.count()).where(
            EquipmentReading.clinic_id == clinic_id,
            EquipmentReading.is_deleted == False,
            EquipmentReading.is_alert == True,
            EquipmentReading.created_at >= since,
        )
    )
    alert_count = alert_result.scalar() or 0

    # Maintenance due
    cutoff = datetime.now(timezone.utc) + timedelta(days=7)
    maint_result = await session.execute(
        select(func.count()).where(
            MedicalEquipment.clinic_id == clinic_id,
            MedicalEquipment.is_deleted == False,
            MedicalEquipment.next_maintenance != None,
            MedicalEquipment.next_maintenance <= cutoff,
            MedicalEquipment.status != EquipmentStatus.DECOMMISSIONED,
        )
    )
    maintenance_due_count = maint_result.scalar() or 0

    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "by_type": by_type,
        "connected": connected_count,
        "alerts_24h": alert_count,
        "maintenance_due": maintenance_due_count,
    }
