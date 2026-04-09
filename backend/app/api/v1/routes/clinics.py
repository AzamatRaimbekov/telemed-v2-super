import uuid
from fastapi import APIRouter, Query
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.clinic import ClinicCreate, ClinicOut, ClinicUpdate
from app.services.clinic import ClinicService

router = APIRouter(prefix="/clinics", tags=["Clinics"])

@router.get("", response_model=list[ClinicOut])
async def list_clinics(session: DBSession, _admin=require_role(UserRole.SUPER_ADMIN), skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)):
    service = ClinicService(session)
    return await service.list_clinics(skip, limit)

@router.post("", response_model=ClinicOut, status_code=201)
async def create_clinic(data: ClinicCreate, session: DBSession, _admin=require_role(UserRole.SUPER_ADMIN)):
    service = ClinicService(session)
    return await service.create_clinic(data)

@router.get("/{clinic_id}", response_model=ClinicOut)
async def get_clinic(clinic_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = ClinicService(session)
    return await service.get_clinic(clinic_id)

@router.patch("/{clinic_id}", response_model=ClinicOut)
async def update_clinic(clinic_id: uuid.UUID, data: ClinicUpdate, session: DBSession, _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN)):
    service = ClinicService(session)
    return await service.update_clinic(clinic_id, data)

@router.delete("/{clinic_id}", status_code=204)
async def delete_clinic(clinic_id: uuid.UUID, session: DBSession, _admin=require_role(UserRole.SUPER_ADMIN)):
    service = ClinicService(session)
    await service.delete_clinic(clinic_id)
