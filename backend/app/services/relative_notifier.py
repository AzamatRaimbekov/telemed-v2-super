from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.patient import Patient, PatientGuardian


class RelativeNotifierService:
    """Notify patient relatives/guardians about admission and discharge events."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def notify_admission(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> dict:
        """Notify relatives when patient is admitted."""
        patient = await self._get_patient(patient_id)
        guardians = await self._get_guardians(patient_id)

        if not patient or not guardians:
            return {"notified": 0, "message": "Нет контактных лиц"}

        patient_name = f"{patient.last_name} {patient.first_name}"
        messages_sent = 0

        for g in guardians:
            phone = getattr(g.guardian, "phone", None) if g.guardian else None
            if phone:
                try:
                    from app.services.notification_dispatcher import NotificationDispatcher

                    dispatcher = NotificationDispatcher(self.db)
                    await dispatcher.send(
                        channel="SMS",
                        recipient=phone,
                        body=f"Уважаемый(ая)! Пациент {patient_name} поступил(а) в клинику. Для информации обратитесь в регистратуру.",
                        clinic_id=clinic_id,
                        related_type="admission",
                    )
                    messages_sent += 1
                except Exception:
                    pass

        return {"notified": messages_sent, "total_guardians": len(guardians)}

    async def notify_discharge(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> dict:
        """Notify relatives when patient is discharged."""
        patient = await self._get_patient(patient_id)
        guardians = await self._get_guardians(patient_id)

        if not patient or not guardians:
            return {"notified": 0}

        patient_name = f"{patient.last_name} {patient.first_name}"
        messages_sent = 0

        for g in guardians:
            phone = getattr(g.guardian, "phone", None) if g.guardian else None
            if phone:
                try:
                    from app.services.notification_dispatcher import NotificationDispatcher

                    dispatcher = NotificationDispatcher(self.db)
                    await dispatcher.send(
                        channel="SMS",
                        recipient=phone,
                        body=f"Пациент {patient_name} выписан(а) из клиники. Подробности в регистратуре.",
                        clinic_id=clinic_id,
                        related_type="discharge",
                    )
                    messages_sent += 1
                except Exception:
                    pass

        return {"notified": messages_sent}

    async def _get_patient(self, patient_id: uuid.UUID) -> Patient | None:
        result = await self.db.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        return result.scalar_one_or_none()

    async def _get_guardians(self, patient_id: uuid.UUID) -> list[PatientGuardian]:
        result = await self.db.execute(
            select(PatientGuardian)
            .where(PatientGuardian.patient_id == patient_id)
            .options(selectinload(PatientGuardian.guardian))
        )
        return list(result.scalars().all())
