import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password
from app.models.patient import Patient
from app.models.medical import MedicalCard, Visit
from app.models.vital_signs import VitalSign
from app.models.treatment import TreatmentPlan, TreatmentPlanItem
from app.models.laboratory import LabOrder, LabResult
from app.models.exercise import ExerciseSession


class PatientService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_patients(self, clinic_id: uuid.UUID, skip: int = 0, limit: int = 20, search: str | None = None, status: str | None = None, doctor_id: uuid.UUID | None = None) -> tuple[list[Patient], int]:
        query = select(Patient).where(Patient.clinic_id == clinic_id, Patient.is_deleted == False)
        count_query = select(func.count()).select_from(Patient).where(Patient.clinic_id == clinic_id, Patient.is_deleted == False)

        if search:
            search_filter = or_(
                Patient.first_name.ilike(f"%{search}%"),
                Patient.last_name.ilike(f"%{search}%"),
                Patient.passport_number.ilike(f"%{search}%"),
                Patient.inn.ilike(f"%{search}%"),
                Patient.phone.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        if status:
            query = query.where(Patient.status == status)
            count_query = count_query.where(Patient.status == status)

        if doctor_id:
            query = query.where(Patient.assigned_doctor_id == doctor_id)
            count_query = count_query.where(Patient.assigned_doctor_id == doctor_id)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        query = query.order_by(Patient.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def get_patient(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> Patient:
        query = select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id, Patient.is_deleted == False)
        result = await self.session.execute(query)
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundError("Patient", str(patient_id))
        return patient

    async def create_patient(self, data: dict, clinic_id: uuid.UUID) -> Patient:
        portal_password = data.pop("portal_password", None)
        face_snapshot_id = data.pop("face_snapshot_id", None)

        data["clinic_id"] = clinic_id
        data["id"] = uuid.uuid4()

        if portal_password:
            data["portal_password_hash"] = hash_password(portal_password)

        # Handle enum values
        gender = data.get("gender", "MALE")
        blood_type = data.get("blood_type", "UNKNOWN")
        registration_source = data.get("registration_source", "WALK_IN")

        patient = Patient(**data)
        self.session.add(patient)
        await self.session.flush()

        # Auto-create medical card
        card_seq = await self.session.execute(select(func.count()).select_from(MedicalCard).where(MedicalCard.clinic_id == clinic_id))
        seq_num = card_seq.scalar_one() + 1
        card = MedicalCard(
            id=uuid.uuid4(),
            patient_id=patient.id,
            card_number=f"MC-{datetime.now().year}-{seq_num:04d}",
            opened_at=datetime.now(timezone.utc),
            clinic_id=clinic_id,
        )
        self.session.add(card)
        await self.session.flush()
        await self.session.refresh(patient)
        return patient

    async def update_patient(self, patient_id: uuid.UUID, data: dict, clinic_id: uuid.UUID) -> Patient:
        patient = await self.get_patient(patient_id, clinic_id)
        for key, value in data.items():
            if value is not None and hasattr(patient, key):
                setattr(patient, key, value)
        await self.session.flush()
        await self.session.refresh(patient)
        return patient

    async def delete_patient(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        patient = await self.get_patient(patient_id, clinic_id)
        patient.is_deleted = True
        await self.session.flush()

    async def get_medical_card(self, patient_id: uuid.UUID) -> MedicalCard | None:
        query = select(MedicalCard).where(MedicalCard.patient_id == patient_id, MedicalCard.is_deleted == False)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_visits(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[Visit]:
        query = select(Visit).where(Visit.patient_id == patient_id, Visit.clinic_id == clinic_id, Visit.is_deleted == False).order_by(Visit.started_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_vital_signs(self, data: dict, recorded_by_id: uuid.UUID, clinic_id: uuid.UUID) -> VitalSign:
        vital = VitalSign(
            id=uuid.uuid4(),
            recorded_by_id=recorded_by_id,
            recorded_at=datetime.now(timezone.utc),
            clinic_id=clinic_id,
            **data,
        )
        self.session.add(vital)
        await self.session.flush()
        await self.session.refresh(vital)
        return vital

    async def get_vitals(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[VitalSign]:
        query = select(VitalSign).where(VitalSign.patient_id == patient_id, VitalSign.clinic_id == clinic_id, VitalSign.is_deleted == False).order_by(VitalSign.recorded_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def approve_lab_result(self, result_id: uuid.UUID, doctor_id: uuid.UUID, visible: bool = True) -> LabResult:
        query = select(LabResult).where(LabResult.id == result_id, LabResult.is_deleted == False)
        result = await self.session.execute(query)
        lab_result = result.scalar_one_or_none()
        if not lab_result:
            raise NotFoundError("LabResult", str(result_id))
        lab_result.visible_to_patient = visible
        lab_result.approved_by_id = doctor_id
        lab_result.approved_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(lab_result)
        return lab_result

    async def get_lab_results(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        from app.models.laboratory import LabTestCatalog
        query = (
            select(LabResult, LabOrder, LabTestCatalog)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .join(LabTestCatalog, LabOrder.test_id == LabTestCatalog.id)
            .where(LabOrder.patient_id == patient_id, LabOrder.clinic_id == clinic_id, LabResult.is_deleted == False)
            .order_by(LabResult.resulted_at.desc())
        )
        result = await self.session.execute(query)
        return [
            {
                "id": r.id, "test_name": t.name, "test_code": t.code, "value": r.value,
                "numeric_value": float(r.numeric_value) if r.numeric_value else None,
                "unit": r.unit, "reference_range": r.reference_range, "is_abnormal": r.is_abnormal,
                "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
                "visible_to_patient": r.visible_to_patient, "resulted_at": r.resulted_at,
                "approved_by_id": r.approved_by_id, "approved_at": r.approved_at,
            }
            for r, o, t in result.all()
        ]

    async def create_treatment_plan(self, data: dict, doctor_id: uuid.UUID, clinic_id: uuid.UUID) -> TreatmentPlan:
        plan = TreatmentPlan(
            id=uuid.uuid4(),
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            **data,
        )
        self.session.add(plan)
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def get_treatment_plans(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[TreatmentPlan]:
        query = select(TreatmentPlan).where(TreatmentPlan.patient_id == patient_id, TreatmentPlan.clinic_id == clinic_id, TreatmentPlan.is_deleted == False).order_by(TreatmentPlan.created_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_treatment_item(self, data: dict, clinic_id: uuid.UUID) -> TreatmentPlanItem:
        item = TreatmentPlanItem(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def get_treatment_items(self, plan_id: uuid.UUID) -> list[TreatmentPlanItem]:
        query = select(TreatmentPlanItem).where(TreatmentPlanItem.treatment_plan_id == plan_id, TreatmentPlanItem.is_deleted == False).order_by(TreatmentPlanItem.sort_order)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_exercise_sessions(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[ExerciseSession]:
        query = select(ExerciseSession).where(ExerciseSession.patient_id == patient_id, ExerciseSession.clinic_id == clinic_id, ExerciseSession.is_deleted == False).order_by(ExerciseSession.started_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())
