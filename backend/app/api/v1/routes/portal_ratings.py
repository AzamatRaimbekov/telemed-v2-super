from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.exceptions import NotFoundError
from app.models.patient import Patient
from app.models.rating import DoctorRating
from app.api.v1.routes.portal import get_portal_patient
from typing import Annotated

router = APIRouter(prefix="/portal/ratings", tags=["Portal — Ratings"])

DBSession = Annotated[AsyncSession, Depends(get_session)]
PortalPatient = Annotated[Patient, Depends(get_portal_patient)]


class RatingCreate(BaseModel):
    doctor_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    appointment_id: Optional[uuid.UUID] = None


class RatingOut(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    rating: int
    comment: Optional[str]
    appointment_id: Optional[uuid.UUID]
    created_at: str

    class Config:
        from_attributes = True


class DoctorRatingStats(BaseModel):
    doctor_id: uuid.UUID
    average_rating: float
    count: int


@router.post("", response_model=RatingOut)
async def submit_rating(data: RatingCreate, patient: PortalPatient, session: DBSession):
    """Submit a rating for a doctor."""
    rating = DoctorRating(
        patient_id=patient.id,
        doctor_id=data.doctor_id,
        rating=data.rating,
        comment=data.comment,
        appointment_id=data.appointment_id,
        clinic_id=patient.clinic_id,
    )
    session.add(rating)
    await session.commit()
    await session.refresh(rating)
    return RatingOut(
        id=rating.id,
        doctor_id=rating.doctor_id,
        rating=rating.rating,
        comment=rating.comment,
        appointment_id=rating.appointment_id,
        created_at=rating.created_at.isoformat(),
    )


@router.get("/my", response_model=list[RatingOut])
async def my_ratings(patient: PortalPatient, session: DBSession):
    """List my submitted ratings."""
    query = (
        select(DoctorRating)
        .where(DoctorRating.patient_id == patient.id, DoctorRating.is_deleted == False)
        .order_by(DoctorRating.created_at.desc())
    )
    result = await session.execute(query)
    rows = result.scalars().all()
    return [
        RatingOut(
            id=r.id,
            doctor_id=r.doctor_id,
            rating=r.rating,
            comment=r.comment,
            appointment_id=r.appointment_id,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/doctors/{doctor_id}", response_model=DoctorRatingStats)
async def doctor_rating_stats(doctor_id: uuid.UUID, session: DBSession):
    """Get average rating and count for a doctor."""
    query = select(
        func.avg(DoctorRating.rating).label("avg"),
        func.count(DoctorRating.id).label("cnt"),
    ).where(DoctorRating.doctor_id == doctor_id, DoctorRating.is_deleted == False)
    result = await session.execute(query)
    row = result.one()
    return DoctorRatingStats(
        doctor_id=doctor_id,
        average_rating=round(float(row.avg or 0), 2),
        count=row.cnt,
    )
