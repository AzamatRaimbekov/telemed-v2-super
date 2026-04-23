from __future__ import annotations
import uuid
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.exceptions import NotFoundError
from app.models.patient import Patient
from app.models.medication_reminder import MedicationReminder
from app.api.v1.routes.portal import get_portal_patient
from typing import Annotated

router = APIRouter(prefix="/portal/reminders", tags=["Portal — Reminders"])

DBSession = Annotated[AsyncSession, Depends(get_session)]
PortalPatient = Annotated[Patient, Depends(get_portal_patient)]


class ReminderCreate(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    times: list[str]
    start_date: date
    end_date: Optional[date] = None


class ReminderUpdate(BaseModel):
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    times: Optional[list[str]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class ReminderOut(BaseModel):
    id: uuid.UUID
    medication_name: str
    dosage: str
    frequency: str
    times: list[str]
    start_date: date
    end_date: Optional[date]
    is_active: bool

    class Config:
        from_attributes = True


class TodayScheduleItem(BaseModel):
    medication_name: str
    dosage: str
    time: str


@router.post("", response_model=ReminderOut)
async def create_reminder(data: ReminderCreate, patient: PortalPatient, session: DBSession):
    """Create a medication reminder."""
    reminder = MedicationReminder(
        patient_id=patient.id,
        medication_name=data.medication_name,
        dosage=data.dosage,
        frequency=data.frequency,
        times=data.times,
        start_date=data.start_date,
        end_date=data.end_date,
        clinic_id=patient.clinic_id,
    )
    session.add(reminder)
    await session.commit()
    await session.refresh(reminder)
    return ReminderOut.model_validate(reminder)


@router.get("", response_model=list[ReminderOut])
async def list_reminders(patient: PortalPatient, session: DBSession):
    """List active medication reminders."""
    query = (
        select(MedicationReminder)
        .where(
            MedicationReminder.patient_id == patient.id,
            MedicationReminder.is_active == True,
            MedicationReminder.is_deleted == False,
        )
        .order_by(MedicationReminder.created_at.desc())
    )
    result = await session.execute(query)
    return [ReminderOut.model_validate(r) for r in result.scalars().all()]


@router.put("/{reminder_id}", response_model=ReminderOut)
async def update_reminder(
    reminder_id: uuid.UUID, data: ReminderUpdate, patient: PortalPatient, session: DBSession
):
    """Update a medication reminder."""
    query = select(MedicationReminder).where(
        MedicationReminder.id == reminder_id,
        MedicationReminder.patient_id == patient.id,
        MedicationReminder.is_deleted == False,
    )
    result = await session.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise NotFoundError("Reminder not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    await session.commit()
    await session.refresh(reminder)
    return ReminderOut.model_validate(reminder)


@router.delete("/{reminder_id}")
async def deactivate_reminder(reminder_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    """Deactivate a medication reminder."""
    query = select(MedicationReminder).where(
        MedicationReminder.id == reminder_id,
        MedicationReminder.patient_id == patient.id,
        MedicationReminder.is_deleted == False,
    )
    result = await session.execute(query)
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise NotFoundError("Reminder not found")
    reminder.is_active = False
    await session.commit()
    return {"message": "Reminder deactivated"}


@router.get("/today", response_model=list[TodayScheduleItem])
async def today_schedule(patient: PortalPatient, session: DBSession):
    """Get today's medication schedule."""
    today = date.today()
    query = select(MedicationReminder).where(
        MedicationReminder.patient_id == patient.id,
        MedicationReminder.is_active == True,
        MedicationReminder.is_deleted == False,
        MedicationReminder.start_date <= today,
    )
    result = await session.execute(query)
    reminders = result.scalars().all()
    schedule = []
    for r in reminders:
        if r.end_date and r.end_date < today:
            continue
        for t in (r.times or []):
            schedule.append(TodayScheduleItem(
                medication_name=r.medication_name,
                dosage=r.dosage,
                time=t,
            ))
    schedule.sort(key=lambda x: x.time)
    return schedule
