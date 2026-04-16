from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.room_assignment import RoomAssignment
from app.models.facility import Bed, BedStatus, Room


class RoomAssignmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_current(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> RoomAssignment | None:
        query = (
            select(RoomAssignment)
            .where(
                RoomAssignment.patient_id == patient_id,
                RoomAssignment.clinic_id == clinic_id,
                RoomAssignment.released_at.is_(None),
                RoomAssignment.is_deleted == False,
            )
            .order_by(RoomAssignment.assigned_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_history(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        hospitalization_id: uuid.UUID | None = None,
    ) -> list[RoomAssignment]:
        where_clauses = [
            RoomAssignment.patient_id == patient_id,
            RoomAssignment.clinic_id == clinic_id,
            RoomAssignment.is_deleted == False,
        ]
        if hospitalization_id:
            where_clauses.append(RoomAssignment.hospitalization_id == hospitalization_id)

        query = (
            select(RoomAssignment)
            .where(*where_clauses)
            .order_by(RoomAssignment.assigned_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def transfer(
        self,
        patient_id: uuid.UUID,
        data: dict,
        transferred_by_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> RoomAssignment:
        now = datetime.now(timezone.utc)

        # Close current assignment if exists
        current = await self.get_current(patient_id, clinic_id)
        if current:
            current.released_at = now
            diff = now - current.assigned_at
            current.duration_minutes = int(diff.total_seconds() / 60)
            current.transfer_reason = data.get("transfer_reason")
            current.condition_on_transfer = data.get("condition_on_transfer")
            current.transferred_by = transferred_by_id

            # Free the old bed
            old_bed_q = await self.session.execute(select(Bed).where(Bed.id == current.bed_id))
            old_bed = old_bed_q.scalar_one_or_none()
            if old_bed:
                old_bed.status = BedStatus.AVAILABLE

        # Validate new bed exists
        new_bed_q = await self.session.execute(select(Bed).where(Bed.id == data["bed_id"]))
        new_bed = new_bed_q.scalar_one_or_none()
        if not new_bed:
            raise NotFoundError("Bed", str(data["bed_id"]))

        # Validate bed is available
        if new_bed.status != BedStatus.AVAILABLE:
            raise ValidationError(f"Койка {new_bed.bed_number} занята или на обслуживании")

        # Get room to find department_id
        room_q = await self.session.execute(select(Room).where(Room.id == data["room_id"]))
        room = room_q.scalar_one_or_none()
        if not room:
            raise NotFoundError("Room", str(data["room_id"]))

        # Occupy the new bed
        new_bed.status = BedStatus.OCCUPIED

        # Determine hospitalization_id: carry from current or use None
        hospitalization_id = current.hospitalization_id if current else None

        assignment = RoomAssignment(
            id=uuid.uuid4(),
            patient_id=patient_id,
            clinic_id=clinic_id,
            hospitalization_id=hospitalization_id,
            department_id=room.department_id,
            room_id=data["room_id"],
            bed_id=data["bed_id"],
            placement_type=data.get("placement_type"),
            assigned_at=now,
            notes=data.get("notes"),
        )
        self.session.add(assignment)
        await self.session.flush()
        await self.session.refresh(assignment)
        return assignment

    async def get_room_availability(self, room_id: uuid.UUID) -> dict:
        room_q = await self.session.execute(select(Room).where(Room.id == room_id))
        room = room_q.scalar_one_or_none()
        if not room:
            raise NotFoundError("Room", str(room_id))

        beds = []
        for bed in room.beds:
            # Check if bed has an active assignment
            assignment_q = await self.session.execute(
                select(RoomAssignment)
                .where(
                    RoomAssignment.bed_id == bed.id,
                    RoomAssignment.released_at.is_(None),
                    RoomAssignment.is_deleted == False,
                )
                .limit(1)
            )
            active_assignment = assignment_q.scalar_one_or_none()

            beds.append({
                "id": bed.id,
                "bed_number": bed.bed_number,
                "status": bed.status.value if hasattr(bed.status, "value") else str(bed.status),
                "patient_id": active_assignment.patient_id if active_assignment else None,
            })

        return {
            "id": room.id,
            "name": room.name,
            "room_number": room.room_number,
            "room_type": room.room_type.value if hasattr(room.room_type, "value") else str(room.room_type),
            "capacity": room.capacity,
            "floor": room.floor,
            "department_id": room.department_id,
            "beds": beds,
            "total_beds": len(beds),
            "available_beds": sum(1 for b in beds if b["status"] == "AVAILABLE"),
            "occupied_beds": sum(1 for b in beds if b["status"] == "OCCUPIED"),
        }
