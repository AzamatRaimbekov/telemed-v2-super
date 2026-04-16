from __future__ import annotations
import uuid
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.models.facility import Department, Room, Bed, BedStatus, RoomType
from app.schemas.room_assignment import RoomTransfer
from app.services.room_assignment import RoomAssignmentService

router = APIRouter(prefix="", tags=["Rooms"])


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------

async def _serialize_assignment(a, session) -> dict:
    """Serialize a RoomAssignment with flattened fields the frontend expects."""
    room = a.room
    dept = a.department
    bed = a.bed

    # Count occupied beds in the room
    occupied_count = 0
    if room:
        count_q = select(func.count()).select_from(Bed).where(
            Bed.room_id == room.id,
            Bed.status == BedStatus.OCCUPIED,
            Bed.is_deleted == False,
        )
        result = await session.execute(count_q)
        occupied_count = result.scalar_one()

    return {
        "id": str(a.id),
        "patient_id": str(a.patient_id),
        "hospitalization_id": str(a.hospitalization_id) if a.hospitalization_id else None,
        "room_id": str(a.room_id) if a.room_id else None,
        "bed_id": str(a.bed_id) if a.bed_id else None,
        "department_id": str(a.department_id) if a.department_id else None,
        "placement_type": a.placement_type.value if a.placement_type and hasattr(a.placement_type, "value") else a.placement_type,
        "assigned_at": a.assigned_at,
        "released_at": a.released_at,
        "discharged_at": a.released_at,  # alias for frontend
        "duration_minutes": a.duration_minutes,
        "transfer_reason": a.transfer_reason,
        "transferred_by": str(a.transferred_by) if a.transferred_by else None,
        "condition_on_transfer": a.condition_on_transfer.value if a.condition_on_transfer and hasattr(a.condition_on_transfer, "value") else a.condition_on_transfer,
        "notes": a.notes,
        "created_at": a.created_at,
        # Flattened fields for frontend
        "room_name": room.name if room else None,
        "room_number": room.room_number if room else None,
        "room_type": room.room_type.value if room and hasattr(room.room_type, "value") else (str(room.room_type) if room else None),
        "department_name": dept.name if dept else None,
        "bed_number": bed.bed_number if bed else None,
        # Occupancy
        "occupied": occupied_count,
        "capacity": room.capacity if room else None,
        # Nested objects for backward compat
        "department": {
            "id": str(dept.id),
            "name": dept.name,
            "code": dept.code,
        } if dept else None,
        "room": {
            "id": str(room.id),
            "name": room.name,
            "room_number": room.room_number,
            "room_type": room.room_type.value if hasattr(room.room_type, "value") else str(room.room_type),
            "floor": room.floor,
            "capacity": room.capacity,
        } if room else None,
        "bed": {
            "id": str(bed.id),
            "bed_number": bed.bed_number,
            "status": bed.status.value if hasattr(bed.status, "value") else str(bed.status),
        } if bed else None,
    }


# ---------------------------------------------------------------------------
# Patient room assignment endpoints
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_id}/rooms/current")
async def get_current_room(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = RoomAssignmentService(session)
    assignment = await service.get_current(patient_id, current_user.clinic_id)
    if not assignment:
        return None
    return await _serialize_assignment(assignment, session)


@router.get("/patients/{patient_id}/rooms/history")
async def get_room_history(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    all_hospitalizations: bool = Query(True),
):
    service = RoomAssignmentService(session)
    hospitalization_id = None if all_hospitalizations else None
    assignments = await service.get_history(patient_id, current_user.clinic_id, hospitalization_id)
    return [await _serialize_assignment(a, session) for a in assignments]


@router.post("/patients/{patient_id}/rooms/transfer", status_code=201)
async def transfer_patient(
    patient_id: uuid.UUID,
    data: RoomTransfer,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.CLINIC_ADMIN),
):
    service = RoomAssignmentService(session)
    assignment = await service.transfer(
        patient_id, data.model_dump(), current_user.id, current_user.clinic_id
    )
    return await _serialize_assignment(assignment, session)


@router.get("/rooms/{room_id}/availability")
async def get_room_availability(
    room_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    service = RoomAssignmentService(session)
    return await service.get_room_availability(room_id)


# ---------------------------------------------------------------------------
# DTOs for CRUD
# ---------------------------------------------------------------------------

class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    head_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    head_id: uuid.UUID | None = None
    is_active: bool | None = None


class RoomCreate(BaseModel):
    department_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    room_number: str | None = Field(default=None, max_length=50)
    room_type: str = "WARD"
    capacity: int | None = None
    floor: int = 1


class RoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    room_number: str | None = Field(default=None, max_length=50)
    room_type: str | None = None
    capacity: int | None = None
    floor: int | None = None
    is_active: bool | None = None


class BedCreate(BaseModel):
    bed_number: str = Field(..., min_length=1, max_length=50)
    status: str = "AVAILABLE"


class BedUpdate(BaseModel):
    bed_number: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = None


# ---------------------------------------------------------------------------
# Department CRUD
# ---------------------------------------------------------------------------

@router.get("/departments")
async def list_departments(session: DBSession, current_user: CurrentUser):
    query = select(Department).where(
        Department.clinic_id == current_user.clinic_id,
        Department.is_active == True,
        Department.is_deleted == False,
    )
    result = await session.execute(query)
    return [
        {"id": str(d.id), "name": d.name, "code": d.code, "description": d.description, "is_active": d.is_active}
        for d in result.scalars().all()
    ]


@router.post("/departments", status_code=201)
async def create_department(
    data: DepartmentCreate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    dept = Department(
        id=uuid.uuid4(),
        name=data.name,
        code=data.code,
        description=data.description,
        head_id=data.head_id,
        is_active=True,
        clinic_id=current_user.clinic_id,
    )
    session.add(dept)
    await session.flush()
    return {"id": str(dept.id), "name": dept.name, "code": dept.code, "description": dept.description, "is_active": dept.is_active}


@router.patch("/departments/{department_id}")
async def update_department(
    department_id: uuid.UUID,
    data: DepartmentUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Department).where(
        Department.id == department_id,
        Department.clinic_id == current_user.clinic_id,
        Department.is_deleted == False,
    )
    result = await session.execute(query)
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError("Department", str(department_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dept, field, value)

    await session.flush()
    return {"id": str(dept.id), "name": dept.name, "code": dept.code, "description": dept.description, "is_active": dept.is_active}


@router.delete("/departments/{department_id}", status_code=204)
async def delete_department(
    department_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Department).where(
        Department.id == department_id,
        Department.clinic_id == current_user.clinic_id,
        Department.is_deleted == False,
    )
    result = await session.execute(query)
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError("Department", str(department_id))

    dept.is_deleted = True
    dept.is_active = False
    await session.flush()


# ---------------------------------------------------------------------------
# Room CRUD
# ---------------------------------------------------------------------------

@router.post("/rooms", status_code=201)
async def create_room(
    data: RoomCreate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    room = Room(
        id=uuid.uuid4(),
        department_id=data.department_id,
        name=data.name,
        room_number=data.room_number,
        room_type=RoomType(data.room_type),
        capacity=data.capacity,
        floor=data.floor,
        is_active=True,
        clinic_id=current_user.clinic_id,
    )
    session.add(room)
    await session.flush()
    return {
        "id": str(room.id),
        "name": room.name,
        "room_number": room.room_number,
        "room_type": room.room_type.value,
        "capacity": room.capacity,
        "floor": room.floor,
        "department_id": str(room.department_id),
        "is_active": room.is_active,
    }


@router.patch("/rooms/{room_id}")
async def update_room(
    room_id: uuid.UUID,
    data: RoomUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Room).where(
        Room.id == room_id,
        Room.clinic_id == current_user.clinic_id,
        Room.is_deleted == False,
    )
    result = await session.execute(query)
    room = result.scalar_one_or_none()
    if not room:
        raise NotFoundError("Room", str(room_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "room_type" and value is not None:
            value = RoomType(value)
        setattr(room, field, value)

    await session.flush()
    return {
        "id": str(room.id),
        "name": room.name,
        "room_number": room.room_number,
        "room_type": room.room_type.value,
        "capacity": room.capacity,
        "floor": room.floor,
        "department_id": str(room.department_id),
        "is_active": room.is_active,
    }


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Room).where(
        Room.id == room_id,
        Room.clinic_id == current_user.clinic_id,
        Room.is_deleted == False,
    )
    result = await session.execute(query)
    room = result.scalar_one_or_none()
    if not room:
        raise NotFoundError("Room", str(room_id))

    room.is_deleted = True
    room.is_active = False
    await session.flush()


# ---------------------------------------------------------------------------
# Bed CRUD
# ---------------------------------------------------------------------------

@router.post("/rooms/{room_id}/beds", status_code=201)
async def create_bed(
    room_id: uuid.UUID,
    data: BedCreate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    # Verify room exists and belongs to clinic
    room_q = select(Room).where(
        Room.id == room_id,
        Room.clinic_id == current_user.clinic_id,
        Room.is_deleted == False,
    )
    room_r = await session.execute(room_q)
    room = room_r.scalar_one_or_none()
    if not room:
        raise NotFoundError("Room", str(room_id))

    bed = Bed(
        id=uuid.uuid4(),
        room_id=room_id,
        bed_number=data.bed_number,
        status=BedStatus(data.status),
        clinic_id=current_user.clinic_id,
    )
    session.add(bed)
    await session.flush()
    return {"id": str(bed.id), "bed_number": bed.bed_number, "status": bed.status.value, "room_id": str(bed.room_id)}


@router.patch("/beds/{bed_id}")
async def update_bed(
    bed_id: uuid.UUID,
    data: BedUpdate,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Bed).where(
        Bed.id == bed_id,
        Bed.clinic_id == current_user.clinic_id,
        Bed.is_deleted == False,
    )
    result = await session.execute(query)
    bed = result.scalar_one_or_none()
    if not bed:
        raise NotFoundError("Bed", str(bed_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value is not None:
            value = BedStatus(value)
        setattr(bed, field, value)

    await session.flush()
    return {"id": str(bed.id), "bed_number": bed.bed_number, "status": bed.status.value, "room_id": str(bed.room_id)}


@router.delete("/beds/{bed_id}", status_code=204)
async def delete_bed(
    bed_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    from app.core.exceptions import NotFoundError

    query = select(Bed).where(
        Bed.id == bed_id,
        Bed.clinic_id == current_user.clinic_id,
        Bed.is_deleted == False,
    )
    result = await session.execute(query)
    bed = result.scalar_one_or_none()
    if not bed:
        raise NotFoundError("Bed", str(bed_id))

    bed.is_deleted = True
    await session.flush()
