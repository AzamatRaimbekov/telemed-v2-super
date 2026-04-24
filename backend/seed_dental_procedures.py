"""Seed dental procedures catalog with 30+ common procedures."""
from __future__ import annotations
import asyncio
import uuid
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.dental_procedure import DentalProcedure

CLINIC_ID = "ab676372-69fa-4af8-be33-91c1e307b4fc"

PROCEDURES = [
    # Therapy / Терапия
    {"code": "DEN-001", "name": "Лечение кариеса (1 поверхность)", "category": "therapy", "base_price": 2500, "duration_minutes": 30},
    {"code": "DEN-002", "name": "Лечение кариеса (2 поверхности)", "category": "therapy", "base_price": 3500, "duration_minutes": 40},
    {"code": "DEN-003", "name": "Пломба светоотверждаемая", "category": "therapy", "base_price": 3000, "duration_minutes": 30},
    {"code": "DEN-004", "name": "Реставрация зуба композитом", "category": "therapy", "base_price": 5000, "duration_minutes": 60},
    {"code": "DEN-005", "name": "Лечение пульпита", "category": "therapy", "base_price": 4500, "duration_minutes": 60},

    # Surgery / Хирургия
    {"code": "DEN-006", "name": "Удаление зуба простое", "category": "surgery", "base_price": 2000, "duration_minutes": 20},
    {"code": "DEN-007", "name": "Удаление зуба сложное", "category": "surgery", "base_price": 4000, "duration_minutes": 40},
    {"code": "DEN-008", "name": "Удаление зуба мудрости", "category": "surgery", "base_price": 6000, "duration_minutes": 60},
    {"code": "DEN-009", "name": "Резекция верхушки корня", "category": "surgery", "base_price": 7000, "duration_minutes": 60},
    {"code": "DEN-010", "name": "Пластика уздечки", "category": "surgery", "base_price": 3000, "duration_minutes": 30},

    # Endodontics / Эндодонтия
    {"code": "DEN-011", "name": "Лечение каналов (1-канальный)", "category": "endodontics", "base_price": 5000, "duration_minutes": 60},
    {"code": "DEN-012", "name": "Лечение каналов (2-канальный)", "category": "endodontics", "base_price": 7000, "duration_minutes": 90},
    {"code": "DEN-013", "name": "Лечение каналов (3-канальный)", "category": "endodontics", "base_price": 9000, "duration_minutes": 90},
    {"code": "DEN-014", "name": "Перелечивание канала", "category": "endodontics", "base_price": 8000, "duration_minutes": 90},

    # Prosthetics / Протезирование
    {"code": "DEN-015", "name": "Коронка металлокерамика", "category": "prosthetics", "base_price": 12000, "duration_minutes": 60},
    {"code": "DEN-016", "name": "Коронка диоксид циркония", "category": "prosthetics", "base_price": 18000, "duration_minutes": 60},
    {"code": "DEN-017", "name": "Мостовидный протез (1 единица)", "category": "prosthetics", "base_price": 14000, "duration_minutes": 60},
    {"code": "DEN-018", "name": "Съёмный протез частичный", "category": "prosthetics", "base_price": 20000, "duration_minutes": 90},
    {"code": "DEN-019", "name": "Съёмный протез полный", "category": "prosthetics", "base_price": 30000, "duration_minutes": 90},
    {"code": "DEN-020", "name": "Винир керамический", "category": "prosthetics", "base_price": 15000, "duration_minutes": 60},

    # Ortho / Ортодонтия
    {"code": "DEN-021", "name": "Брекеты металлические (1 челюсть)", "category": "ortho", "base_price": 25000, "duration_minutes": 90},
    {"code": "DEN-022", "name": "Брекеты керамические (1 челюсть)", "category": "ortho", "base_price": 35000, "duration_minutes": 90},
    {"code": "DEN-023", "name": "Элайнеры (комплект)", "category": "ortho", "base_price": 80000, "duration_minutes": 60},
    {"code": "DEN-024", "name": "Ретейнер несъёмный", "category": "ortho", "base_price": 5000, "duration_minutes": 30},

    # Hygiene / Гигиена
    {"code": "DEN-025", "name": "Профессиональная чистка (ультразвук)", "category": "hygiene", "base_price": 3000, "duration_minutes": 45},
    {"code": "DEN-026", "name": "Air Flow", "category": "hygiene", "base_price": 2500, "duration_minutes": 30},
    {"code": "DEN-027", "name": "Фторирование (оба челюсти)", "category": "hygiene", "base_price": 1500, "duration_minutes": 15},
    {"code": "DEN-028", "name": "Герметизация фиссур (1 зуб)", "category": "hygiene", "base_price": 1500, "duration_minutes": 15},

    # Implantology / Имплантология
    {"code": "DEN-029", "name": "Имплант (Osstem)", "category": "implantology", "base_price": 35000, "duration_minutes": 90},
    {"code": "DEN-030", "name": "Имплант (Straumann)", "category": "implantology", "base_price": 55000, "duration_minutes": 90},
    {"code": "DEN-031", "name": "Формирователь десны", "category": "implantology", "base_price": 5000, "duration_minutes": 20},
    {"code": "DEN-032", "name": "Абатмент", "category": "implantology", "base_price": 8000, "duration_minutes": 30},
    {"code": "DEN-033", "name": "Синус-лифтинг", "category": "implantology", "base_price": 25000, "duration_minutes": 120},

    # Pediatric / Детская стоматология
    {"code": "DEN-034", "name": "Серебрение молочного зуба", "category": "pediatric", "base_price": 500, "duration_minutes": 10},
    {"code": "DEN-035", "name": "Лечение молочного зуба", "category": "pediatric", "base_price": 2000, "duration_minutes": 30},
    {"code": "DEN-036", "name": "Удаление молочного зуба", "category": "pediatric", "base_price": 1000, "duration_minutes": 15},
    {"code": "DEN-037", "name": "Герметизация фиссур молочного зуба", "category": "pediatric", "base_price": 1200, "duration_minutes": 15},
]


async def seed():
    async with async_session_factory() as session:
        # Check if already seeded
        existing = await session.execute(select(DentalProcedure).limit(1))
        if existing.scalar_one_or_none():
            print("Dental procedures already seeded. Skipping.")
            return

        for p in PROCEDURES:
            session.add(DentalProcedure(
                id=uuid.uuid4(),
                clinic_id=CLINIC_ID,
                code=p["code"],
                name=p["name"],
                category=p["category"],
                base_price=p["base_price"],
                duration_minutes=p["duration_minutes"],
                is_active=True,
            ))
        await session.commit()
        print(f"Seeded: {len(PROCEDURES)} dental procedures")


if __name__ == "__main__":
    asyncio.run(seed())
