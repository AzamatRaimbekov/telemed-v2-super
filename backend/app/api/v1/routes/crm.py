from __future__ import annotations

import uuid
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.crm import CRMLead, LeadStatus, LeadSource

router = APIRouter(prefix="/crm", tags=["CRM / Лиды"])


# ---------- schemas ----------

class LeadCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    source: LeadSource = LeadSource.PHONE
    interested_in: str | None = None
    assigned_to_id: uuid.UUID | None = None
    notes: str | None = None
    tags: dict | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    source: LeadSource | None = None
    interested_in: str | None = None
    assigned_to_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    notes: str | None = None
    tags: dict | None = None


class StatusUpdate(BaseModel):
    status: LeadStatus


# ---------- helpers ----------

def _lead_to_dict(lead: CRMLead) -> dict:
    return {
        "id": str(lead.id),
        "name": lead.name,
        "phone": lead.phone,
        "email": lead.email,
        "source": lead.source.value if isinstance(lead.source, LeadSource) else lead.source,
        "status": lead.status.value if isinstance(lead.status, LeadStatus) else lead.status,
        "interested_in": lead.interested_in,
        "assigned_to_id": str(lead.assigned_to_id) if lead.assigned_to_id else None,
        "patient_id": str(lead.patient_id) if lead.patient_id else None,
        "notes": lead.notes,
        "tags": lead.tags,
        "created_at": lead.created_at.isoformat(),
        "updated_at": lead.updated_at.isoformat(),
    }


# ---------- endpoints ----------

@router.get("/leads")
async def list_leads(
    session: DBSession,
    current_user: CurrentUser,
    status: LeadStatus | None = None,
    source: LeadSource | None = None,
    search: str | None = None,
):
    """List all leads with optional filters."""
    q = select(CRMLead).where(
        CRMLead.clinic_id == current_user.clinic_id,
        CRMLead.is_deleted == False,
    )
    if status:
        q = q.where(CRMLead.status == status)
    if source:
        q = q.where(CRMLead.source == source)
    if search:
        q = q.where(CRMLead.name.ilike(f"%{search}%") | CRMLead.phone.ilike(f"%{search}%"))
    q = q.order_by(CRMLead.created_at.desc())
    result = await session.execute(q)
    return [_lead_to_dict(l) for l in result.scalars().all()]


@router.post("/leads", status_code=201)
async def create_lead(
    data: LeadCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new lead."""
    lead = CRMLead(
        clinic_id=current_user.clinic_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        source=data.source,
        status=LeadStatus.NEW,
        interested_in=data.interested_in,
        assigned_to_id=data.assigned_to_id,
        notes=data.notes,
        tags=data.tags,
    )
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return _lead_to_dict(lead)


@router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a lead."""
    result = await session.execute(
        select(CRMLead).where(
            CRMLead.id == lead_id,
            CRMLead.clinic_id == current_user.clinic_id,
            CRMLead.is_deleted == False,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Lead not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    await session.commit()
    await session.refresh(lead)
    return _lead_to_dict(lead)


@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a lead."""
    result = await session.execute(
        select(CRMLead).where(
            CRMLead.id == lead_id,
            CRMLead.clinic_id == current_user.clinic_id,
            CRMLead.is_deleted == False,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Lead not found"}
    lead.is_deleted = True
    await session.commit()
    return {"status": "deleted"}


@router.patch("/leads/{lead_id}/status")
async def update_lead_status(
    lead_id: uuid.UUID,
    data: StatusUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Change lead status."""
    result = await session.execute(
        select(CRMLead).where(
            CRMLead.id == lead_id,
            CRMLead.clinic_id == current_user.clinic_id,
            CRMLead.is_deleted == False,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Lead not found"}
    lead.status = data.status
    await session.commit()
    await session.refresh(lead)
    return _lead_to_dict(lead)


@router.get("/leads/stats")
async def lead_stats(
    session: DBSession,
    current_user: CurrentUser,
):
    """Conversion funnel stats — count of leads per status."""
    result = await session.execute(
        select(
            CRMLead.status,
            func.count().label("count"),
        ).where(
            CRMLead.clinic_id == current_user.clinic_id,
            CRMLead.is_deleted == False,
        ).group_by(CRMLead.status)
    )
    funnel = {row.status.value if isinstance(row.status, LeadStatus) else row.status: row.count for row in result.all()}
    total = sum(funnel.values())
    converted = funnel.get("converted", 0)
    return {
        "funnel": funnel,
        "total": total,
        "converted": converted,
        "conversion_rate": round(converted / total * 100, 1) if total > 0 else 0,
    }


@router.get("/leads/sources")
async def leads_by_source(
    session: DBSession,
    current_user: CurrentUser,
):
    """Leads grouped by source."""
    result = await session.execute(
        select(
            CRMLead.source,
            func.count().label("count"),
        ).where(
            CRMLead.clinic_id == current_user.clinic_id,
            CRMLead.is_deleted == False,
        ).group_by(CRMLead.source)
    )
    return [
        {
            "source": row.source.value if isinstance(row.source, LeadSource) else row.source,
            "count": row.count,
        }
        for row in result.all()
    ]
