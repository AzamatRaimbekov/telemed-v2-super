from fastapi import APIRouter
from app.api.deps import CurrentUser, DBSession
from app.models.clinic import Clinic
from sqlalchemy import select

router = APIRouter(prefix="/clinic-map", tags=["Clinic Map"])


@router.get("/")
async def get_clinic_map_data(
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(Clinic).where(Clinic.id == current_user.clinic_id)
    )
    clinic = result.scalar_one_or_none()

    return {
        "name": clinic.name if clinic else "MedCore Клиника",
        "address": clinic.address if clinic else "г. Бишкек",
        "phone": clinic.phone if clinic else "",
        "coordinates": {
            "lat": 42.8746,
            "lng": 74.5698,
        },
        "working_hours": {
            "weekdays": "Пн-Пт: 8:00 - 18:00",
            "saturday": "Сб: 9:00 - 14:00",
            "sunday": "Вс: выходной",
        },
        "floors": [
            {"floor": 1, "departments": ["Регистратура", "Аптека", "Приёмное отделение"]},
            {"floor": 2, "departments": ["Терапия", "Кардиология", "Неврология"]},
            {"floor": 3, "departments": ["Лаборатория", "Процедурный кабинет", "Рентген"]},
        ],
        "parking": {"available": True, "spots": 30, "description": "Бесплатная парковка перед зданием"},
        "map_urls": {
            "2gis": "https://2gis.kg/bishkek",
            "google": "https://maps.google.com/?q=42.8746,74.5698",
            "yandex": "https://yandex.kg/maps/?ll=74.5698,42.8746&z=16",
        },
    }
