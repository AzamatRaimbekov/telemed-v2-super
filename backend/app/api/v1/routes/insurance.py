from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.insurance import InsuranceCompany, InsurancePolicy, InsuranceClaim

router = APIRouter(prefix="/insurance", tags=["Insurance / Страховые компании"])


# ---------- schemas ----------

class CompanyCreate(BaseModel):
    name: str
    code: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    contract_number: str | None = None
    contract_valid_until: date | None = None
    discount_percent: float = 0
    is_active: bool = True
    covered_services: list[str] | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    contract_number: str | None = None
    contract_valid_until: date | None = None
    discount_percent: float | None = None
    is_active: bool | None = None
    covered_services: list[str] | None = None


class PolicyCreate(BaseModel):
    patient_id: uuid.UUID
    company_id: uuid.UUID
    policy_number: str
    valid_from: date
    valid_until: date
    coverage_type: str = "standard"
    max_amount: float | None = None


class ClaimCreate(BaseModel):
    policy_id: uuid.UUID
    invoice_id: uuid.UUID | None = None
    claim_amount: float


class ClaimAction(BaseModel):
    approved_amount: float | None = None
    rejection_reason: str | None = None


# ---------- helpers ----------

def _company_to_dict(c: InsuranceCompany) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "code": c.code,
        "contact_person": c.contact_person,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "contract_number": c.contract_number,
        "contract_valid_until": c.contract_valid_until.isoformat() if c.contract_valid_until else None,
        "discount_percent": c.discount_percent,
        "is_active": c.is_active,
        "covered_services": c.covered_services,
        "created_at": c.created_at.isoformat(),
    }


def _policy_to_dict(p: InsurancePolicy) -> dict:
    return {
        "id": str(p.id),
        "patient_id": str(p.patient_id),
        "company_id": str(p.company_id),
        "policy_number": p.policy_number,
        "valid_from": p.valid_from.isoformat(),
        "valid_until": p.valid_until.isoformat(),
        "coverage_type": p.coverage_type,
        "max_amount": p.max_amount,
        "used_amount": p.used_amount,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
    }


def _claim_to_dict(c: InsuranceClaim) -> dict:
    return {
        "id": str(c.id),
        "policy_id": str(c.policy_id),
        "invoice_id": str(c.invoice_id) if c.invoice_id else None,
        "claim_amount": c.claim_amount,
        "approved_amount": c.approved_amount,
        "status": c.status,
        "rejection_reason": c.rejection_reason,
        "created_at": c.created_at.isoformat(),
    }


# ---------- companies ----------

@router.get("/companies")
async def list_companies(
    session: DBSession,
    current_user: CurrentUser,
    is_active: bool | None = None,
):
    """List all insurance companies."""
    q = select(InsuranceCompany).where(
        InsuranceCompany.clinic_id == current_user.clinic_id,
        InsuranceCompany.is_deleted == False,
    )
    if is_active is not None:
        q = q.where(InsuranceCompany.is_active == is_active)
    q = q.order_by(InsuranceCompany.name)
    result = await session.execute(q)
    return [_company_to_dict(c) for c in result.scalars().all()]


@router.post("/companies", status_code=201)
async def create_company(
    data: CompanyCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create an insurance company."""
    company = InsuranceCompany(
        clinic_id=current_user.clinic_id,
        name=data.name,
        code=data.code,
        contact_person=data.contact_person,
        phone=data.phone,
        email=data.email,
        address=data.address,
        contract_number=data.contract_number,
        contract_valid_until=data.contract_valid_until,
        discount_percent=data.discount_percent,
        is_active=data.is_active,
        covered_services=data.covered_services,
    )
    session.add(company)
    await session.commit()
    await session.refresh(company)
    return _company_to_dict(company)


@router.put("/companies/{company_id}")
async def update_company(
    company_id: uuid.UUID,
    data: CompanyUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update an insurance company."""
    result = await session.execute(
        select(InsuranceCompany).where(
            InsuranceCompany.id == company_id,
            InsuranceCompany.clinic_id == current_user.clinic_id,
            InsuranceCompany.is_deleted == False,
        )
    )
    company = result.scalar_one_or_none()
    if not company:
        return {"error": "Company not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    await session.commit()
    await session.refresh(company)
    return _company_to_dict(company)


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete an insurance company."""
    result = await session.execute(
        select(InsuranceCompany).where(
            InsuranceCompany.id == company_id,
            InsuranceCompany.clinic_id == current_user.clinic_id,
            InsuranceCompany.is_deleted == False,
        )
    )
    company = result.scalar_one_or_none()
    if not company:
        return {"error": "Company not found"}
    company.is_deleted = True
    await session.commit()
    return {"status": "deleted"}


# ---------- policies ----------

@router.get("/policies")
async def list_policies(
    session: DBSession,
    current_user: CurrentUser,
    is_active: bool | None = None,
):
    """List all insurance policies."""
    q = select(InsurancePolicy).where(
        InsurancePolicy.clinic_id == current_user.clinic_id,
        InsurancePolicy.is_deleted == False,
    )
    if is_active is not None:
        q = q.where(InsurancePolicy.is_active == is_active)
    q = q.order_by(InsurancePolicy.created_at.desc())
    result = await session.execute(q)
    return [_policy_to_dict(p) for p in result.scalars().all()]


@router.post("/policies", status_code=201)
async def create_policy(
    data: PolicyCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create an insurance policy for a patient."""
    policy = InsurancePolicy(
        clinic_id=current_user.clinic_id,
        patient_id=data.patient_id,
        company_id=data.company_id,
        policy_number=data.policy_number,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        coverage_type=data.coverage_type,
        max_amount=data.max_amount,
        used_amount=0,
        is_active=True,
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return _policy_to_dict(policy)


@router.get("/patient/{patient_id}")
async def get_patient_policies(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get active policies for a patient."""
    today = date.today()
    result = await session.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.clinic_id == current_user.clinic_id,
            InsurancePolicy.patient_id == patient_id,
            InsurancePolicy.is_active == True,
            InsurancePolicy.is_deleted == False,
            InsurancePolicy.valid_until >= today,
        ).order_by(InsurancePolicy.valid_until.desc())
    )
    return [_policy_to_dict(p) for p in result.scalars().all()]


@router.get("/verify/{policy_number}")
async def verify_policy(
    policy_number: str,
    session: DBSession,
    current_user: CurrentUser,
):
    """Check policy validity by policy number."""
    today = date.today()
    result = await session.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.clinic_id == current_user.clinic_id,
            InsurancePolicy.policy_number == policy_number,
            InsurancePolicy.is_deleted == False,
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        return {"valid": False, "reason": "Policy not found"}
    if not policy.is_active:
        return {"valid": False, "reason": "Policy is inactive", "policy": _policy_to_dict(policy)}
    if policy.valid_until < today:
        return {"valid": False, "reason": "Policy expired", "policy": _policy_to_dict(policy)}
    if policy.max_amount and policy.used_amount >= policy.max_amount:
        return {"valid": False, "reason": "Coverage limit reached", "policy": _policy_to_dict(policy)}
    return {"valid": True, "policy": _policy_to_dict(policy)}


# ---------- claims ----------

@router.get("/claims")
async def list_claims(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = None,
):
    """List insurance claims."""
    q = select(InsuranceClaim).where(
        InsuranceClaim.clinic_id == current_user.clinic_id,
        InsuranceClaim.is_deleted == False,
    )
    if status:
        q = q.where(InsuranceClaim.status == status)
    q = q.order_by(InsuranceClaim.created_at.desc())
    result = await session.execute(q)
    return [_claim_to_dict(c) for c in result.scalars().all()]


@router.post("/claims", status_code=201)
async def create_claim(
    data: ClaimCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Submit an insurance claim."""
    claim = InsuranceClaim(
        clinic_id=current_user.clinic_id,
        policy_id=data.policy_id,
        invoice_id=data.invoice_id,
        claim_amount=data.claim_amount,
        status="pending",
    )
    session.add(claim)
    await session.commit()
    await session.refresh(claim)
    return _claim_to_dict(claim)


@router.patch("/claims/{claim_id}/approve")
async def approve_claim(
    claim_id: uuid.UUID,
    data: ClaimAction,
    session: DBSession,
    current_user: CurrentUser,
):
    """Approve an insurance claim."""
    result = await session.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.id == claim_id,
            InsuranceClaim.clinic_id == current_user.clinic_id,
            InsuranceClaim.is_deleted == False,
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        return {"error": "Claim not found"}
    claim.status = "approved"
    claim.approved_amount = data.approved_amount or claim.claim_amount
    await session.commit()
    await session.refresh(claim)
    return _claim_to_dict(claim)


@router.patch("/claims/{claim_id}/reject")
async def reject_claim(
    claim_id: uuid.UUID,
    data: ClaimAction,
    session: DBSession,
    current_user: CurrentUser,
):
    """Reject an insurance claim."""
    result = await session.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.id == claim_id,
            InsuranceClaim.clinic_id == current_user.clinic_id,
            InsuranceClaim.is_deleted == False,
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        return {"error": "Claim not found"}
    claim.status = "rejected"
    claim.rejection_reason = data.rejection_reason
    await session.commit()
    await session.refresh(claim)
    return _claim_to_dict(claim)
