from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.services.gsvz_service import GSVZService

router = APIRouter(prefix="/gsvz", tags=["GSVZ (Government Health System KR)"])


class VisitReportRequest(BaseModel):
    patient_inn: str
    visit_date: str
    diagnosis_code: str
    doctor_inn: str | None = None
    clinic_inn: str | None = None
    notes: str | None = None


@router.get("/verify-insurance/{inn}")
async def verify_insurance(inn: str, current_user: CurrentUser):
    service = GSVZService()
    return await service.verify_patient_insurance(inn)


@router.post("/submit-visit")
async def submit_visit(data: VisitReportRequest, current_user: CurrentUser):
    service = GSVZService()
    return await service.submit_visit_report(data.model_dump())


@router.get("/icd10-updates")
async def icd10_updates(current_user: CurrentUser):
    service = GSVZService()
    return await service.get_icd10_updates()


@router.get("/status")
async def gsvz_status(current_user: CurrentUser):
    service = GSVZService()
    return await service.get_status()
