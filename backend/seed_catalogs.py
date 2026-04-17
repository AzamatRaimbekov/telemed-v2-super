"""Seed medical catalogs: drugs, procedures, lab tests."""
from __future__ import annotations
import asyncio
import uuid
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.medication import Drug, DrugForm
from app.models.procedure import Procedure
from app.models.laboratory import LabTestCatalog

CLINIC_ID = "ab676372-69fa-4af8-be33-91c1e307b4fc"

DRUGS = [
    {"name": "Аспирин", "generic_name": "Ацетилсалициловая кислота", "category": "НПВС", "form": "TABLET", "unit": "мг", "price": 50},
    {"name": "Амоксициллин", "generic_name": "Амоксициллин", "category": "Антибиотики", "form": "CAPSULE", "unit": "мг", "price": 120},
    {"name": "Метформин", "generic_name": "Метформин", "category": "Эндокринология", "form": "TABLET", "unit": "мг", "price": 80},
    {"name": "Лозартан", "generic_name": "Лозартан калий", "category": "Кардиология", "form": "TABLET", "unit": "мг", "price": 150},
    {"name": "Омепразол", "generic_name": "Омепразол", "category": "ЖКТ", "form": "CAPSULE", "unit": "мг", "price": 90},
    {"name": "Эналаприл", "generic_name": "Эналаприл", "category": "Кардиология", "form": "TABLET", "unit": "мг", "price": 70},
    {"name": "Бисопролол", "generic_name": "Бисопролол", "category": "Кардиология", "form": "TABLET", "unit": "мг", "price": 100},
    {"name": "Варфарин", "generic_name": "Варфарин натрий", "category": "Антикоагулянты", "form": "TABLET", "unit": "мг", "price": 200},
    {"name": "Цефтриаксон", "generic_name": "Цефтриаксон", "category": "Антибиотики", "form": "INJECTION", "unit": "г", "price": 250},
    {"name": "Диклофенак", "generic_name": "Диклофенак натрий", "category": "НПВС", "form": "TABLET", "unit": "мг", "price": 60},
    {"name": "Парацетамол", "generic_name": "Парацетамол", "category": "Анальгетики", "form": "TABLET", "unit": "мг", "price": 30},
    {"name": "Ибупрофен", "generic_name": "Ибупрофен", "category": "НПВС", "form": "TABLET", "unit": "мг", "price": 45},
    {"name": "Амлодипин", "generic_name": "Амлодипин", "category": "Кардиология", "form": "TABLET", "unit": "мг", "price": 110},
    {"name": "Дексаметазон", "generic_name": "Дексаметазон", "category": "Гормоны", "form": "INJECTION", "unit": "мг", "price": 180},
    {"name": "Инсулин Хумалог", "generic_name": "Инсулин лизпро", "category": "Эндокринология", "form": "INJECTION", "unit": "ЕД", "price": 800},
]

PROCEDURES = [
    {"name": "ЭКГ", "code": "PROC-001", "category": "Диагностика", "duration_minutes": 15, "price": 500},
    {"name": "УЗИ брюшной полости", "code": "PROC-002", "category": "Диагностика", "duration_minutes": 30, "price": 1200},
    {"name": "КТ головного мозга", "code": "PROC-003", "category": "Диагностика", "duration_minutes": 20, "price": 3500},
    {"name": "МРТ головного мозга", "code": "PROC-004", "category": "Диагностика", "duration_minutes": 40, "price": 5000},
    {"name": "Рентген грудной клетки", "code": "PROC-005", "category": "Диагностика", "duration_minutes": 10, "price": 600},
    {"name": "Физиотерапия (электрофорез)", "code": "PROC-006", "category": "Физиотерапия", "duration_minutes": 20, "price": 400},
    {"name": "Массаж лечебный", "code": "PROC-007", "category": "Физиотерапия", "duration_minutes": 30, "price": 600},
    {"name": "Ингаляция", "code": "PROC-008", "category": "Терапия", "duration_minutes": 15, "price": 300},
    {"name": "Перевязка", "code": "PROC-009", "category": "Хирургия", "duration_minutes": 20, "price": 350},
    {"name": "Катетеризация мочевого пузыря", "code": "PROC-010", "category": "Урология", "duration_minutes": 15, "price": 500},
]

LAB_TESTS = [
    {"name": "Общий анализ крови (ОАК)", "code": "LAB-001", "category": "Гематология", "turnaround_hours": 4, "sample_type": "Кровь", "price": 300},
    {"name": "Биохимия крови", "code": "LAB-002", "category": "Биохимия", "turnaround_hours": 6, "sample_type": "Кровь", "price": 800},
    {"name": "Коагулограмма", "code": "LAB-003", "category": "Гематология", "turnaround_hours": 4, "sample_type": "Кровь", "price": 600},
    {"name": "Общий анализ мочи", "code": "LAB-004", "category": "Общий", "turnaround_hours": 2, "sample_type": "Моча", "price": 200},
    {"name": "Глюкоза крови", "code": "LAB-005", "category": "Биохимия", "turnaround_hours": 2, "sample_type": "Кровь", "price": 150},
    {"name": "Холестерин общий", "code": "LAB-006", "category": "Биохимия", "turnaround_hours": 4, "sample_type": "Кровь", "price": 250},
    {"name": "МНО (INR)", "code": "LAB-007", "category": "Гематология", "turnaround_hours": 3, "sample_type": "Кровь", "price": 400},
    {"name": "Креатинин", "code": "LAB-008", "category": "Биохимия", "turnaround_hours": 4, "sample_type": "Кровь", "price": 200},
    {"name": "АЛТ", "code": "LAB-009", "category": "Биохимия", "turnaround_hours": 4, "sample_type": "Кровь", "price": 200},
    {"name": "АСТ", "code": "LAB-010", "category": "Биохимия", "turnaround_hours": 4, "sample_type": "Кровь", "price": 200},
    {"name": "С-реактивный белок", "code": "LAB-011", "category": "Иммунология", "turnaround_hours": 6, "sample_type": "Кровь", "price": 350},
    {"name": "Электролиты (Na, K, Cl)", "code": "LAB-012", "category": "Биохимия", "turnaround_hours": 3, "sample_type": "Кровь", "price": 500},
]


async def seed():
    async with async_session_factory() as session:
        # Check if already seeded
        existing = await session.execute(select(Drug).limit(1))
        if existing.scalar_one_or_none():
            print("Catalogs already seeded. Skipping.")
            return
        # Drugs
        for d in DRUGS:
            session.add(Drug(
                id=uuid.uuid4(), clinic_id=CLINIC_ID, is_active=True,
                name=d["name"], generic_name=d.get("generic_name"), category=d.get("category"),
                form=DrugForm(d["form"]), unit=d.get("unit"), price=d.get("price"),
                requires_prescription=True,
            ))
        # Procedures
        for p in PROCEDURES:
            session.add(Procedure(
                id=uuid.uuid4(), clinic_id=CLINIC_ID,
                name=p["name"], code=p.get("code"), category=p.get("category"),
                duration_minutes=p.get("duration_minutes"), price=p.get("price"),
            ))
        # Lab Tests
        for t in LAB_TESTS:
            session.add(LabTestCatalog(
                id=uuid.uuid4(), clinic_id=CLINIC_ID,
                name=t["name"], code=t["code"], category=t.get("category"),
                turnaround_hours=t.get("turnaround_hours"), sample_type=t.get("sample_type"),
                price=t.get("price"),
            ))
        await session.commit()
        print(f"Seeded: {len(DRUGS)} drugs, {len(PROCEDURES)} procedures, {len(LAB_TESTS)} lab tests")


if __name__ == "__main__":
    asyncio.run(seed())
