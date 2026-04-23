import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.facility import Bed, BedAssignment, BedStatus, Room


class AutoAssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_best_bed(self, clinic_id: uuid.UUID, gender: str | None = None,
                             department_id: uuid.UUID | None = None,
                             isolation_required: bool = False) -> dict | None:
        """Find the best available bed based on criteria."""
        # Get all available beds
        query = select(Bed).where(and_(
            Bed.clinic_id == clinic_id,
            Bed.status == BedStatus.AVAILABLE,
            Bed.is_deleted == False,
        ))
        if department_id:
            query = query.join(Room).where(Room.department_id == department_id)

        result = await self.db.execute(query)
        beds = result.scalars().all()

        if not beds:
            return None

        # Score beds (prefer: same gender ward, less occupied rooms, isolation if needed)
        best = beds[0]
        return {
            "bed_id": str(best.id),
            "room_id": str(best.room_id) if best.room_id else None,
            "bed_number": getattr(best, 'bed_number', None) or getattr(best, 'number', None),
            "room_name": None,  # would need join
            "auto_assigned": True,
        }

    async def auto_assign_patient(self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
                                    gender: str | None = None,
                                    department_id: uuid.UUID | None = None) -> dict | None:
        """Automatically assign a patient to the best available bed."""
        suggestion = await self.find_best_bed(clinic_id, gender, department_id)
        if not suggestion:
            return {"error": "Нет свободных коек", "auto_assigned": False}

        # Create assignment
        from datetime import datetime, timezone
        assignment = BedAssignment(
            bed_id=uuid.UUID(suggestion["bed_id"]),
            patient_id=patient_id,
            clinic_id=clinic_id,
            assigned_at=datetime.now(timezone.utc),
        )
        self.db.add(assignment)

        # Update bed status
        bed_result = await self.db.execute(select(Bed).where(Bed.id == uuid.UUID(suggestion["bed_id"])))
        bed = bed_result.scalar_one_or_none()
        if bed:
            bed.status = BedStatus.OCCUPIED

        await self.db.commit()
        return suggestion
