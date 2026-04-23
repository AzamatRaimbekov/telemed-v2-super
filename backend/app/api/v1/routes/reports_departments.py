from fastapi import APIRouter
from datetime import date, timedelta
from sqlalchemy import select, func, and_, cast, Date
from app.api.deps import CurrentUser, DBSession
from app.models.facility import Department, Room, Bed, BedAssignment, BedStatus
from app.models.appointment import Appointment

router = APIRouter(prefix="/reports/departments", tags=["Reports - Departments"])

@router.get("/load")
async def department_load(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get load metrics per department: beds total/occupied, appointments today."""
    clinic_id = current_user.clinic_id

    departments_result = await session.execute(
        select(Department).where(and_(
            Department.clinic_id == clinic_id,
            Department.is_deleted == False,
        ))
    )
    departments = departments_result.scalars().all()

    report = []
    for dept in departments:
        # Count beds
        beds_q = await session.execute(
            select(func.count(Bed.id)).where(and_(
                Bed.clinic_id == clinic_id,
                Bed.is_deleted == False,
            )).join(Room).where(Room.department_id == dept.id)
        )
        total_beds = beds_q.scalar() or 0

        occupied_q = await session.execute(
            select(func.count(Bed.id)).where(and_(
                Bed.clinic_id == clinic_id,
                Bed.status == BedStatus.OCCUPIED,
                Bed.is_deleted == False,
            )).join(Room).where(Room.department_id == dept.id)
        )
        occupied = occupied_q.scalar() or 0

        report.append({
            "department_id": str(dept.id),
            "name": dept.name,
            "total_beds": total_beds,
            "occupied_beds": occupied,
            "available_beds": total_beds - occupied,
            "occupancy_rate": round(occupied / total_beds * 100, 1) if total_beds > 0 else 0,
        })

    return report

@router.get("/summary")
async def departments_summary(
    session: DBSession,
    current_user: CurrentUser,
):
    """Overall summary across all departments."""
    clinic_id = current_user.clinic_id

    total_beds = (await session.execute(
        select(func.count(Bed.id)).where(and_(Bed.clinic_id == clinic_id, Bed.is_deleted == False))
    )).scalar() or 0

    occupied = (await session.execute(
        select(func.count(Bed.id)).where(and_(Bed.clinic_id == clinic_id, Bed.status == BedStatus.OCCUPIED, Bed.is_deleted == False))
    )).scalar() or 0

    return {
        "total_beds": total_beds,
        "occupied": occupied,
        "available": total_beds - occupied,
        "occupancy_rate": round(occupied / total_beds * 100, 1) if total_beds > 0 else 0,
    }
