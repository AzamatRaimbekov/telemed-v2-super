from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.exercise import Exercise, ExerciseCategory, ExerciseDifficulty
from app.models.medication import Drug, DrugForm
from app.models.procedure import Procedure
from app.models.laboratory import LabTestCatalog


class SettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ══════════════════════════════════════════════════════════════════════
    # Exercise
    # ══════════════════════════════════════════════════════════════════════

    async def list_exercises(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
        difficulty: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Exercise], int]:
        base = [Exercise.clinic_id == clinic_id, Exercise.is_deleted == False]
        if search:
            base.append(Exercise.name.ilike(f"%{search}%"))
        if category:
            base.append(Exercise.category == ExerciseCategory(category))
        if difficulty:
            base.append(Exercise.difficulty == ExerciseDifficulty(difficulty))

        count_q = select(func.count()).select_from(Exercise).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        q = select(Exercise).where(*base).order_by(Exercise.name).offset(skip).limit(limit)
        items = list((await self.session.execute(q)).scalars().all())
        return items, total

    async def create_exercise(self, data: dict, clinic_id: uuid.UUID) -> Exercise:
        if "category" in data and data["category"]:
            data["category"] = ExerciseCategory(data["category"])
        if "difficulty" in data and data["difficulty"]:
            data["difficulty"] = ExerciseDifficulty(data["difficulty"])
        exercise = Exercise(**data, clinic_id=clinic_id)
        self.session.add(exercise)
        await self.session.flush()
        await self.session.refresh(exercise)
        return exercise

    async def get_exercise(self, exercise_id: uuid.UUID, clinic_id: uuid.UUID) -> Exercise:
        q = select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.clinic_id == clinic_id,
            Exercise.is_deleted == False,
        )
        result = await self.session.execute(q)
        exercise = result.scalar_one_or_none()
        if not exercise:
            raise NotFoundError("Exercise")
        return exercise

    async def update_exercise(self, exercise_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> Exercise:
        exercise = await self.get_exercise(exercise_id, clinic_id)
        if "category" in data and data["category"] is not None:
            data["category"] = ExerciseCategory(data["category"])
        if "difficulty" in data and data["difficulty"] is not None:
            data["difficulty"] = ExerciseDifficulty(data["difficulty"])
        for key, value in data.items():
            setattr(exercise, key, value)
        await self.session.flush()
        await self.session.refresh(exercise)
        return exercise

    async def delete_exercise(self, exercise_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        exercise = await self.get_exercise(exercise_id, clinic_id)
        exercise.is_deleted = True
        await self.session.flush()

    async def toggle_exercise(self, exercise_id: uuid.UUID, clinic_id: uuid.UUID) -> Exercise:
        exercise = await self.get_exercise(exercise_id, clinic_id)
        exercise.is_active = not exercise.is_active
        await self.session.flush()
        await self.session.refresh(exercise)
        return exercise

    async def bulk_create_exercises(self, items: list[dict], clinic_id: uuid.UUID) -> list[Exercise]:
        created = []
        for data in items:
            if "category" in data and data["category"]:
                data["category"] = ExerciseCategory(data["category"])
            if "difficulty" in data and data["difficulty"]:
                data["difficulty"] = ExerciseDifficulty(data["difficulty"])
            exercise = Exercise(**data, clinic_id=clinic_id)
            self.session.add(exercise)
            created.append(exercise)
        await self.session.flush()
        for ex in created:
            await self.session.refresh(ex)
        return created

    # ══════════════════════════════════════════════════════════════════════
    # Drug
    # ══════════════════════════════════════════════════════════════════════

    async def list_drugs(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
        form: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Drug], int]:
        base = [Drug.clinic_id == clinic_id, Drug.is_deleted == False]
        if search:
            base.append(Drug.name.ilike(f"%{search}%"))
        if category:
            base.append(Drug.category == category)
        if form:
            base.append(Drug.form == DrugForm(form))

        count_q = select(func.count()).select_from(Drug).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        q = select(Drug).where(*base).order_by(Drug.name).offset(skip).limit(limit)
        items = list((await self.session.execute(q)).scalars().all())
        return items, total

    async def create_drug(self, data: dict, clinic_id: uuid.UUID) -> Drug:
        if "form" in data and data["form"]:
            data["form"] = DrugForm(data["form"])
        drug = Drug(**data, clinic_id=clinic_id)
        self.session.add(drug)
        await self.session.flush()
        await self.session.refresh(drug)
        return drug

    async def get_drug(self, drug_id: uuid.UUID, clinic_id: uuid.UUID) -> Drug:
        q = select(Drug).where(
            Drug.id == drug_id,
            Drug.clinic_id == clinic_id,
            Drug.is_deleted == False,
        )
        result = await self.session.execute(q)
        drug = result.scalar_one_or_none()
        if not drug:
            raise NotFoundError("Drug")
        return drug

    async def update_drug(self, drug_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> Drug:
        drug = await self.get_drug(drug_id, clinic_id)
        if "form" in data and data["form"] is not None:
            data["form"] = DrugForm(data["form"])
        for key, value in data.items():
            setattr(drug, key, value)
        await self.session.flush()
        await self.session.refresh(drug)
        return drug

    async def delete_drug(self, drug_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        drug = await self.get_drug(drug_id, clinic_id)
        drug.is_deleted = True
        await self.session.flush()

    async def toggle_drug(self, drug_id: uuid.UUID, clinic_id: uuid.UUID) -> Drug:
        drug = await self.get_drug(drug_id, clinic_id)
        drug.is_active = not drug.is_active
        await self.session.flush()
        await self.session.refresh(drug)
        return drug

    async def get_drug_categories(self, clinic_id: uuid.UUID) -> list[str]:
        q = (
            select(Drug.category)
            .where(Drug.clinic_id == clinic_id, Drug.is_deleted == False, Drug.category.isnot(None))
            .distinct()
            .order_by(Drug.category)
        )
        result = await self.session.execute(q)
        return [row[0] for row in result.all()]

    # ══════════════════════════════════════════════════════════════════════
    # Procedure
    # ══════════════════════════════════════════════════════════════════════

    async def list_procedures(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Procedure], int]:
        base = [Procedure.clinic_id == clinic_id, Procedure.is_deleted == False]
        if search:
            base.append(Procedure.name.ilike(f"%{search}%"))
        if category:
            base.append(Procedure.category == category)

        count_q = select(func.count()).select_from(Procedure).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        q = select(Procedure).where(*base).order_by(Procedure.name).offset(skip).limit(limit)
        items = list((await self.session.execute(q)).scalars().all())
        return items, total

    async def create_procedure(self, data: dict, clinic_id: uuid.UUID) -> Procedure:
        procedure = Procedure(**data, clinic_id=clinic_id)
        self.session.add(procedure)
        await self.session.flush()
        await self.session.refresh(procedure)
        return procedure

    async def get_procedure(self, procedure_id: uuid.UUID, clinic_id: uuid.UUID) -> Procedure:
        q = select(Procedure).where(
            Procedure.id == procedure_id,
            Procedure.clinic_id == clinic_id,
            Procedure.is_deleted == False,
        )
        result = await self.session.execute(q)
        procedure = result.scalar_one_or_none()
        if not procedure:
            raise NotFoundError("Procedure")
        return procedure

    async def update_procedure(self, procedure_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> Procedure:
        procedure = await self.get_procedure(procedure_id, clinic_id)
        for key, value in data.items():
            setattr(procedure, key, value)
        await self.session.flush()
        await self.session.refresh(procedure)
        return procedure

    async def delete_procedure(self, procedure_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        procedure = await self.get_procedure(procedure_id, clinic_id)
        procedure.is_deleted = True
        await self.session.flush()

    async def get_procedure_categories(self, clinic_id: uuid.UUID) -> list[str]:
        q = (
            select(Procedure.category)
            .where(Procedure.clinic_id == clinic_id, Procedure.is_deleted == False, Procedure.category.isnot(None))
            .distinct()
            .order_by(Procedure.category)
        )
        result = await self.session.execute(q)
        return [row[0] for row in result.all()]

    # ══════════════════════════════════════════════════════════════════════
    # Lab Test
    # ══════════════════════════════════════════════════════════════════════

    async def list_lab_tests(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[LabTestCatalog], int]:
        base = [LabTestCatalog.clinic_id == clinic_id, LabTestCatalog.is_deleted == False]
        if search:
            base.append(LabTestCatalog.name.ilike(f"%{search}%"))
        if category:
            base.append(LabTestCatalog.category == category)

        count_q = select(func.count()).select_from(LabTestCatalog).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        q = select(LabTestCatalog).where(*base).order_by(LabTestCatalog.name).offset(skip).limit(limit)
        items = list((await self.session.execute(q)).scalars().all())
        return items, total

    async def create_lab_test(self, data: dict, clinic_id: uuid.UUID) -> LabTestCatalog:
        lab_test = LabTestCatalog(**data, clinic_id=clinic_id)
        self.session.add(lab_test)
        await self.session.flush()
        await self.session.refresh(lab_test)
        return lab_test

    async def get_lab_test(self, lab_test_id: uuid.UUID, clinic_id: uuid.UUID) -> LabTestCatalog:
        q = select(LabTestCatalog).where(
            LabTestCatalog.id == lab_test_id,
            LabTestCatalog.clinic_id == clinic_id,
            LabTestCatalog.is_deleted == False,
        )
        result = await self.session.execute(q)
        lab_test = result.scalar_one_or_none()
        if not lab_test:
            raise NotFoundError("LabTest")
        return lab_test

    async def update_lab_test(self, lab_test_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> LabTestCatalog:
        lab_test = await self.get_lab_test(lab_test_id, clinic_id)
        for key, value in data.items():
            setattr(lab_test, key, value)
        await self.session.flush()
        await self.session.refresh(lab_test)
        return lab_test

    async def delete_lab_test(self, lab_test_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        lab_test = await self.get_lab_test(lab_test_id, clinic_id)
        lab_test.is_deleted = True
        await self.session.flush()

    async def get_lab_test_categories(self, clinic_id: uuid.UUID) -> list[str]:
        q = (
            select(LabTestCatalog.category)
            .where(
                LabTestCatalog.clinic_id == clinic_id,
                LabTestCatalog.is_deleted == False,
                LabTestCatalog.category.isnot(None),
            )
            .distinct()
            .order_by(LabTestCatalog.category)
        )
        result = await self.session.execute(q)
        return [row[0] for row in result.all()]

    # ══════════════════════════════════════════════════════════════════════
    # Stats
    # ══════════════════════════════════════════════════════════════════════

    async def get_stats(self, clinic_id: uuid.UUID) -> dict:
        async def _count(model):  # type: ignore[no-untyped-def]
            q = select(func.count()).select_from(model).where(
                model.clinic_id == clinic_id, model.is_deleted == False
            )
            return (await self.session.execute(q)).scalar_one()

        exercises_count = await _count(Exercise)
        drugs_count = await _count(Drug)
        procedures_count = await _count(Procedure)
        lab_tests_count = await _count(LabTestCatalog)

        return {
            "exercises_count": exercises_count,
            "drugs_count": drugs_count,
            "procedures_count": procedures_count,
            "lab_tests_count": lab_tests_count,
        }
