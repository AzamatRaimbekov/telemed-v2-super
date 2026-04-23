from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.exceptions import NotFoundError
from app.models.patient import Patient
from app.models.family_link import FamilyLink
from app.api.v1.routes.portal import get_portal_patient
from typing import Annotated

router = APIRouter(prefix="/portal/family", tags=["Portal — Family"])

DBSession = Annotated[AsyncSession, Depends(get_session)]
PortalPatient = Annotated[Patient, Depends(get_portal_patient)]


class FamilyLinkCreate(BaseModel):
    linked_patient_phone: str
    relationship: str


class FamilyMemberOut(BaseModel):
    id: uuid.UUID
    linked_patient_id: uuid.UUID
    linked_patient_name: str
    relationship: str

    class Config:
        from_attributes = True


@router.post("/link", response_model=FamilyMemberOut)
async def link_family_member(data: FamilyLinkCreate, patient: PortalPatient, session: DBSession):
    """Link another patient as a family member by phone number."""
    query = select(Patient).where(Patient.phone == data.linked_patient_phone, Patient.is_deleted == False)
    result = await session.execute(query)
    linked = result.scalar_one_or_none()
    if not linked:
        raise NotFoundError("Patient with this phone number not found")

    link = FamilyLink(
        primary_patient_id=patient.id,
        linked_patient_id=linked.id,
        relationship=data.relationship,
        clinic_id=patient.clinic_id,
    )
    session.add(link)
    await session.commit()
    await session.refresh(link)
    full_name = f"{linked.last_name or ''} {linked.first_name or ''} {linked.middle_name or ''}".strip()
    return FamilyMemberOut(
        id=link.id,
        linked_patient_id=linked.id,
        linked_patient_name=full_name,
        relationship=link.relationship,
    )


@router.get("/members", response_model=list[FamilyMemberOut])
async def list_family_members(patient: PortalPatient, session: DBSession):
    """List linked family members."""
    query = (
        select(FamilyLink, Patient)
        .join(Patient, FamilyLink.linked_patient_id == Patient.id)
        .where(FamilyLink.primary_patient_id == patient.id, FamilyLink.is_deleted == False)
    )
    result = await session.execute(query)
    rows = result.all()
    return [
        FamilyMemberOut(
            id=link.id,
            linked_patient_id=link.linked_patient_id,
            linked_patient_name=f"{p.last_name or ''} {p.first_name or ''} {p.middle_name or ''}".strip(),
            relationship=link.relationship,
        )
        for link, p in rows
    ]


@router.delete("/{link_id}")
async def unlink_family_member(link_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    """Remove a family link."""
    query = select(FamilyLink).where(
        FamilyLink.id == link_id,
        FamilyLink.primary_patient_id == patient.id,
        FamilyLink.is_deleted == False,
    )
    result = await session.execute(query)
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Family link not found")
    link.is_deleted = True
    await session.commit()
    return {"message": "Family member unlinked"}
