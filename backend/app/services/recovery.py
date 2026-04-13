from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recovery import RecoveryGoal, RecoveryDomainWeight, RecoveryDomain


class RecoveryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_goals(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> list[RecoveryGoal]:
        query = select(RecoveryGoal).where(
            RecoveryGoal.patient_id == patient_id,
            RecoveryGoal.clinic_id == clinic_id,
            RecoveryGoal.is_deleted == False,
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def bulk_upsert_goals(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        set_by_id: uuid.UUID,
        goals: list[dict],
    ) -> list[RecoveryGoal]:
        existing = await self.list_goals(patient_id, clinic_id)
        for goal in existing:
            goal.is_deleted = True

        new_goals: list[RecoveryGoal] = []
        for g in goals:
            goal = RecoveryGoal(
                id=uuid.uuid4(),
                patient_id=patient_id,
                clinic_id=clinic_id,
                set_by_id=set_by_id,
                domain=RecoveryDomain(g["domain"]),
                metric_key=g["metric_key"],
                target_value=g.get("target_value"),
            )
            self.session.add(goal)
            new_goals.append(goal)

        await self.session.flush()
        for goal in new_goals:
            await self.session.refresh(goal)
        return new_goals

    async def list_weights(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> list[RecoveryDomainWeight]:
        query = select(RecoveryDomainWeight).where(
            RecoveryDomainWeight.patient_id == patient_id,
            RecoveryDomainWeight.clinic_id == clinic_id,
            RecoveryDomainWeight.is_deleted == False,
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def bulk_upsert_weights(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        set_by_id: uuid.UUID,
        weights: list[dict],
    ) -> list[RecoveryDomainWeight]:
        existing = await self.list_weights(patient_id, clinic_id)
        for w in existing:
            w.is_deleted = True

        new_weights: list[RecoveryDomainWeight] = []
        for w in weights:
            weight = RecoveryDomainWeight(
                id=uuid.uuid4(),
                patient_id=patient_id,
                clinic_id=clinic_id,
                set_by_id=set_by_id,
                domain=RecoveryDomain(w["domain"]),
                weight=w["weight"],
            )
            self.session.add(weight)
            new_weights.append(weight)

        await self.session.flush()
        for w in new_weights:
            await self.session.refresh(w)
        return new_weights
