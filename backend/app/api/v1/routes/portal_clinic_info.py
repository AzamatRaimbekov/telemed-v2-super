from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.models.patient import Patient
from app.models.clinic import Clinic
from app.api.v1.routes.portal import get_portal_patient
from typing import Annotated

router = APIRouter(prefix="/portal/clinic-info", tags=["Portal — Clinic Info"])

DBSession = Annotated[AsyncSession, Depends(get_session)]
PortalPatient = Annotated[Patient, Depends(get_portal_patient)]


class MapCoordinates(BaseModel):
    lat: float
    lng: float


class ClinicInfoOut(BaseModel):
    name: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    working_hours: Optional[dict]
    map_coordinates: MapCoordinates
    floors_info: list[dict]
    parking_info: str
    directions: str


@router.get("", response_model=ClinicInfoOut)
async def get_clinic_info(patient: PortalPatient, session: DBSession):
    """Get clinic information including map coordinates and directions."""
    query = select(Clinic).where(Clinic.id == patient.clinic_id)
    result = await session.execute(query)
    clinic = result.scalar_one_or_none()

    name = clinic.name if clinic else "MedCore KG"
    address = clinic.address if clinic else None
    phone = clinic.phone if clinic else None
    email = clinic.email if clinic else None
    working_hours = clinic.working_hours if clinic else None

    return ClinicInfoOut(
        name=name,
        address=address or "г. Бишкек, ул. Киевская 44",
        phone=phone or "+996 312 123456",
        email=email or "info@medcore.kg",
        working_hours=working_hours or {
            "monday": "08:00-18:00",
            "tuesday": "08:00-18:00",
            "wednesday": "08:00-18:00",
            "thursday": "08:00-18:00",
            "friday": "08:00-18:00",
            "saturday": "09:00-14:00",
            "sunday": "closed",
        },
        map_coordinates=MapCoordinates(lat=42.8746, lng=74.5698),
        floors_info=[
            {"floor": 1, "description": "Регистратура, приемное отделение, аптека"},
            {"floor": 2, "description": "Лаборатория, кабинеты диагностики"},
            {"floor": 3, "description": "Терапевтические кабинеты, дневной стационар"},
            {"floor": 4, "description": "Хирургическое отделение, операционные"},
        ],
        parking_info="Бесплатная парковка на 50 мест перед главным входом. Парковка для инвалидов — 5 мест у входа.",
        directions="От остановки 'Киевская' — 3 минуты пешком на север. Ориентир — здание с синей вывеской MedCore.",
    )
