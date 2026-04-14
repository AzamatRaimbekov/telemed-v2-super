from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import NotFoundError
from app.models.diagnosis import Diagnosis, DiagnosisStatus


class DiagnosisService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_diagnoses(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID, status: str | None = None
    ) -> list[Diagnosis]:
        query = select(Diagnosis).where(
            Diagnosis.patient_id == patient_id,
            Diagnosis.clinic_id == clinic_id,
            Diagnosis.is_deleted == False,
        )
        if status:
            query = query.where(Diagnosis.status == DiagnosisStatus(status))
        query = query.order_by(desc(Diagnosis.diagnosed_at), desc(Diagnosis.created_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_diagnosis(
        self, diagnosis_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> Diagnosis:
        query = select(Diagnosis).where(
            Diagnosis.id == diagnosis_id,
            Diagnosis.clinic_id == clinic_id,
            Diagnosis.is_deleted == False,
        )
        result = await self.session.execute(query)
        diagnosis = result.scalar_one_or_none()
        if not diagnosis:
            raise NotFoundError("Diagnosis", str(diagnosis_id))
        return diagnosis

    async def create_diagnosis(
        self, data: dict, diagnosed_by_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> Diagnosis:
        status_raw = data.pop("status", "active")
        diagnosis = Diagnosis(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            diagnosed_by_id=diagnosed_by_id,
            status=DiagnosisStatus(status_raw),
            diagnosed_at=data.pop("diagnosed_at", None) or datetime.now(timezone.utc),
            **data,
        )
        self.session.add(diagnosis)
        await self.session.flush()
        await self.session.refresh(diagnosis)
        return diagnosis

    async def update_diagnosis(
        self, diagnosis_id: uuid.UUID, data: dict, clinic_id: uuid.UUID
    ) -> Diagnosis:
        diagnosis = await self.get_diagnosis(diagnosis_id, clinic_id)
        for key, value in data.items():
            if value is not None and hasattr(diagnosis, key):
                if key == "status":
                    setattr(diagnosis, key, DiagnosisStatus(value))
                else:
                    setattr(diagnosis, key, value)
        await self.session.flush()
        await self.session.refresh(diagnosis)
        return diagnosis

    async def delete_diagnosis(
        self, diagnosis_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> None:
        diagnosis = await self.get_diagnosis(diagnosis_id, clinic_id)
        diagnosis.is_deleted = True
        await self.session.flush()
