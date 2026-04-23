from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.corporate import CorporateContract, CorporateEmployee

router = APIRouter(prefix="/corporate", tags=["Corporate Contracts / Корпоративные договоры"])


# ---------- schemas ----------

class ContractCreate(BaseModel):
    company_name: str
    company_inn: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    contract_number: str
    valid_from: date
    valid_until: date
    max_employees: int | None = None
    max_amount: float | None = None
    discount_percent: float = 0
    covered_services: dict | None = None
    is_active: bool = True
    notes: str | None = None


class ContractUpdate(BaseModel):
    company_name: str | None = None
    company_inn: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    max_employees: int | None = None
    max_amount: float | None = None
    discount_percent: float | None = None
    covered_services: dict | None = None
    is_active: bool | None = None
    notes: str | None = None


class EmployeeCreate(BaseModel):
    employee_name: str
    employee_id_number: str | None = None
    patient_id: uuid.UUID | None = None
    position: str | None = None


class VerifyEmployeeRequest(BaseModel):
    employee_name: str | None = None
    employee_id_number: str | None = None


# ---------- helpers ----------

def _contract_to_dict(c: CorporateContract) -> dict:
    return {
        "id": str(c.id),
        "company_name": c.company_name,
        "company_inn": c.company_inn,
        "contact_person": c.contact_person,
        "contact_phone": c.contact_phone,
        "contact_email": c.contact_email,
        "contract_number": c.contract_number,
        "valid_from": c.valid_from.isoformat(),
        "valid_until": c.valid_until.isoformat(),
        "max_employees": c.max_employees,
        "max_amount": c.max_amount,
        "used_amount": c.used_amount,
        "discount_percent": c.discount_percent,
        "covered_services": c.covered_services,
        "is_active": c.is_active,
        "notes": c.notes,
        "created_at": c.created_at.isoformat(),
    }


def _employee_to_dict(e: CorporateEmployee) -> dict:
    return {
        "id": str(e.id),
        "contract_id": str(e.contract_id),
        "patient_id": str(e.patient_id) if e.patient_id else None,
        "employee_name": e.employee_name,
        "employee_id_number": e.employee_id_number,
        "position": e.position,
        "is_active": e.is_active,
        "created_at": e.created_at.isoformat(),
    }


# ---------- contract endpoints ----------

@router.get("/contracts")
async def list_contracts(
    session: DBSession,
    current_user: CurrentUser,
    active_only: bool = False,
    search: str | None = None,
):
    """List all corporate contracts."""
    q = select(CorporateContract).where(
        CorporateContract.clinic_id == current_user.clinic_id,
        CorporateContract.is_deleted == False,
    )
    if active_only:
        q = q.where(CorporateContract.is_active == True)
    if search:
        q = q.where(
            CorporateContract.company_name.ilike(f"%{search}%")
            | CorporateContract.contract_number.ilike(f"%{search}%")
        )
    q = q.order_by(CorporateContract.created_at.desc())
    result = await session.execute(q)
    return [_contract_to_dict(c) for c in result.scalars().all()]


@router.post("/contracts", status_code=201)
async def create_contract(
    data: ContractCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a corporate contract."""
    contract = CorporateContract(
        clinic_id=current_user.clinic_id,
        company_name=data.company_name,
        company_inn=data.company_inn,
        contact_person=data.contact_person,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        contract_number=data.contract_number,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        max_employees=data.max_employees,
        max_amount=data.max_amount,
        discount_percent=data.discount_percent,
        covered_services=data.covered_services,
        is_active=data.is_active,
        notes=data.notes,
    )
    session.add(contract)
    await session.commit()
    await session.refresh(contract)
    return _contract_to_dict(contract)


@router.put("/contracts/{contract_id}")
async def update_contract(
    contract_id: uuid.UUID,
    data: ContractUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Update a corporate contract."""
    result = await session.execute(
        select(CorporateContract).where(
            CorporateContract.id == contract_id,
            CorporateContract.clinic_id == current_user.clinic_id,
            CorporateContract.is_deleted == False,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        return {"error": "Contract not found"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contract, field, value)
    await session.commit()
    await session.refresh(contract)
    return _contract_to_dict(contract)


@router.delete("/contracts/{contract_id}")
async def delete_contract(
    contract_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Soft-delete a corporate contract."""
    result = await session.execute(
        select(CorporateContract).where(
            CorporateContract.id == contract_id,
            CorporateContract.clinic_id == current_user.clinic_id,
            CorporateContract.is_deleted == False,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        return {"error": "Contract not found"}
    contract.is_deleted = True
    await session.commit()
    return {"status": "deleted"}


# ---------- employee endpoints ----------

@router.get("/contracts/{contract_id}/employees")
async def list_employees(
    contract_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """List employees under a corporate contract."""
    result = await session.execute(
        select(CorporateEmployee).where(
            CorporateEmployee.contract_id == contract_id,
            CorporateEmployee.clinic_id == current_user.clinic_id,
            CorporateEmployee.is_deleted == False,
        ).order_by(CorporateEmployee.employee_name)
    )
    return [_employee_to_dict(e) for e in result.scalars().all()]


@router.post("/contracts/{contract_id}/employees", status_code=201)
async def add_employee(
    contract_id: uuid.UUID,
    data: EmployeeCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    """Add employee to a corporate contract."""
    # Verify contract exists
    cr = await session.execute(
        select(CorporateContract).where(
            CorporateContract.id == contract_id,
            CorporateContract.clinic_id == current_user.clinic_id,
            CorporateContract.is_deleted == False,
        )
    )
    contract = cr.scalar_one_or_none()
    if not contract:
        return {"error": "Contract not found"}

    # Check max employees
    if contract.max_employees:
        count_result = await session.execute(
            select(func.count()).where(
                CorporateEmployee.contract_id == contract_id,
                CorporateEmployee.is_active == True,
                CorporateEmployee.is_deleted == False,
            )
        )
        current_count = count_result.scalar() or 0
        if current_count >= contract.max_employees:
            return {"error": f"Employee limit reached ({contract.max_employees})"}

    emp = CorporateEmployee(
        clinic_id=current_user.clinic_id,
        contract_id=contract_id,
        patient_id=data.patient_id,
        employee_name=data.employee_name,
        employee_id_number=data.employee_id_number,
        position=data.position,
    )
    session.add(emp)
    await session.commit()
    await session.refresh(emp)
    return _employee_to_dict(emp)


# ---------- usage & verify ----------

@router.get("/contracts/{contract_id}/usage")
async def contract_usage(
    contract_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Usage report for a corporate contract."""
    cr = await session.execute(
        select(CorporateContract).where(
            CorporateContract.id == contract_id,
            CorporateContract.clinic_id == current_user.clinic_id,
            CorporateContract.is_deleted == False,
        )
    )
    contract = cr.scalar_one_or_none()
    if not contract:
        return {"error": "Contract not found"}

    emp_count = await session.execute(
        select(func.count()).where(
            CorporateEmployee.contract_id == contract_id,
            CorporateEmployee.is_active == True,
            CorporateEmployee.is_deleted == False,
        )
    )
    active_employees = emp_count.scalar() or 0

    remaining_amount = None
    usage_percent = None
    if contract.max_amount and contract.max_amount > 0:
        remaining_amount = round(contract.max_amount - contract.used_amount, 2)
        usage_percent = round(contract.used_amount / contract.max_amount * 100, 1)

    today = date.today()
    is_valid = contract.is_active and contract.valid_from <= today <= contract.valid_until

    return {
        "contract": _contract_to_dict(contract),
        "active_employees": active_employees,
        "max_employees": contract.max_employees,
        "used_amount": contract.used_amount,
        "max_amount": contract.max_amount,
        "remaining_amount": remaining_amount,
        "usage_percent": usage_percent,
        "is_valid": is_valid,
        "days_remaining": (contract.valid_until - today).days if is_valid else 0,
    }


@router.post("/verify-employee")
async def verify_employee(
    data: VerifyEmployeeRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Verify if a person is a corporate employee by name or ID number."""
    if not data.employee_name and not data.employee_id_number:
        return {"error": "Provide employee_name or employee_id_number"}

    q = select(CorporateEmployee, CorporateContract).join(
        CorporateContract, CorporateContract.id == CorporateEmployee.contract_id
    ).where(
        CorporateEmployee.clinic_id == current_user.clinic_id,
        CorporateEmployee.is_active == True,
        CorporateEmployee.is_deleted == False,
        CorporateContract.is_active == True,
        CorporateContract.is_deleted == False,
    )
    if data.employee_name:
        q = q.where(CorporateEmployee.employee_name.ilike(f"%{data.employee_name}%"))
    if data.employee_id_number:
        q = q.where(CorporateEmployee.employee_id_number == data.employee_id_number)

    result = await session.execute(q)
    rows = result.all()
    if not rows:
        return {"verified": False, "message": "Сотрудник не найден"}

    today = date.today()
    matches = []
    for emp, contract in rows:
        is_valid = contract.valid_from <= today <= contract.valid_until
        matches.append({
            "employee": _employee_to_dict(emp),
            "contract": _contract_to_dict(contract),
            "contract_valid": is_valid,
            "discount_percent": contract.discount_percent,
        })
    return {"verified": True, "matches": matches}
