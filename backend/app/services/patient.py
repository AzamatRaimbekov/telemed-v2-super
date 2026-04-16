from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password
from app.models.patient import Patient
from app.models.medical import MedicalCard, Visit
from app.models.facility import Bed, BedStatus, BedAssignment
from app.models.vital_signs import VitalSign
from app.models.treatment import TreatmentPlan, TreatmentPlanItem
from app.models.laboratory import LabOrder, LabResult
from app.models.exercise import ExerciseSession
from app.models.audit import AuditLog


async def create_audit_log(
    session: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID,
    clinic_id: uuid.UUID,
    old_values: dict | None = None,
    new_values: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """Create an audit log entry for tracking changes to resources."""
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        clinic_id=clinic_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(audit)
    await session.flush()
    return audit


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

    async def create_patient(
        self,
        data: dict,
        clinic_id: uuid.UUID,
        changed_by_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Patient:
        portal_password = data.pop("portal_password", None)
        face_snapshot_id = data.pop("face_snapshot_id", None)
        bed_id = data.pop("bed_id", None)
        # Remove registration-only fields not on the Patient model
        data.pop("department_id", None)
        data.pop("admission_type", None)
        data.pop("treatment_form", None)
        data.pop("admission_notes", None)

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

        # Bed assignment if provided
        if bed_id:
            bed_q = await self.session.execute(select(Bed).where(Bed.id == bed_id))
            bed = bed_q.scalar_one_or_none()
            if bed:
                bed.status = BedStatus.OCCUPIED
                assignment = BedAssignment(
                    id=uuid.uuid4(),
                    bed_id=bed_id,
                    patient_id=patient.id,
                    assigned_at=datetime.now(timezone.utc),
                    clinic_id=clinic_id,
                )
                self.session.add(assignment)

        await self.session.flush()
        await self.session.refresh(patient)

        # Audit log
        if changed_by_id:
            await create_audit_log(
                session=self.session,
                user_id=changed_by_id,
                action="patient_created",
                resource_type="patient",
                resource_id=patient.id,
                clinic_id=clinic_id,
                new_values={"first_name": patient.first_name, "last_name": patient.last_name},
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return patient

    async def update_patient(
        self,
        patient_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
        changed_by_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Patient:
        patient = await self.get_patient(patient_id, clinic_id)

        old_values = {}
        new_values = {}
        for key, value in data.items():
            if value is not None and hasattr(patient, key):
                old_val = getattr(patient, key)
                # Convert enums to string for JSON serialization
                if hasattr(old_val, "value"):
                    old_val = old_val.value
                if old_val != value:
                    old_values[key] = old_val
                    new_values[key] = value
                setattr(patient, key, value)

        await self.session.flush()
        await self.session.refresh(patient)

        # Audit log
        if changed_by_id and new_values:
            await create_audit_log(
                session=self.session,
                user_id=changed_by_id,
                action="patient_updated",
                resource_type="patient",
                resource_id=patient_id,
                clinic_id=clinic_id,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return patient

    async def delete_patient(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        changed_by_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        patient = await self.get_patient(patient_id, clinic_id)
        patient.is_deleted = True
        await self.session.flush()

        # Audit log
        if changed_by_id:
            await create_audit_log(
                session=self.session,
                user_id=changed_by_id,
                action="patient_deleted",
                resource_type="patient",
                resource_id=patient_id,
                clinic_id=clinic_id,
                old_values={"first_name": patient.first_name, "last_name": patient.last_name},
                ip_address=ip_address,
                user_agent=user_agent,
            )

    async def reset_portal_password(
        self,
        patient_id: uuid.UUID,
        new_password: str,
        clinic_id: uuid.UUID,
        changed_by_id: uuid.UUID,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Patient:
        """Reset the portal password for a patient."""
        patient = await self.get_patient(patient_id, clinic_id)
        patient.portal_password_hash = hash_password(new_password)
        await self.session.flush()

        await create_audit_log(
            session=self.session,
            user_id=changed_by_id,
            action="portal_password_reset",
            resource_type="patient",
            resource_id=patient_id,
            clinic_id=clinic_id,
            new_values={"password_changed": True},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        await self.session.refresh(patient)
        return patient

    async def get_patient_audit_logs(
        self,
        patient_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        action: str | None = None,
    ) -> tuple[list[dict], int]:
        """Get audit logs for a specific patient with user info."""
        from app.models.user import User

        base_filter = [
            AuditLog.resource_type == "patient",
            AuditLog.resource_id == patient_id,
            AuditLog.is_deleted == False,
        ]
        if action:
            base_filter.append(AuditLog.action == action)

        # Count query
        count_query = select(func.count()).select_from(AuditLog).where(*base_filter)
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        # Data query with user join
        query = (
            select(AuditLog, User)
            .outerjoin(User, AuditLog.user_id == User.id)
            .where(*base_filter)
            .order_by(AuditLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        rows = result.all()

        items = []
        for audit, user in rows:
            user_name = None
            user_role = None
            if user:
                user_name = f"{user.last_name} {user.first_name}"
                if user.middle_name:
                    user_name = f"{user.last_name} {user.first_name} {user.middle_name}"
                user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
            items.append({
                "id": audit.id,
                "action": audit.action,
                "user_name": user_name,
                "user_role": user_role,
                "old_values": audit.old_values,
                "new_values": audit.new_values,
                "ip_address": audit.ip_address,
                "user_agent": audit.user_agent,
                "created_at": audit.created_at,
            })

        return items, total

    async def approve_lab_result(
        self,
        result_id: uuid.UUID,
        doctor_id: uuid.UUID,
        visible: bool = True,
        clinic_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> LabResult:
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

        # Audit log
        if clinic_id:
            # Find patient_id through the lab order
            order_q = await self.session.execute(
                select(LabOrder.patient_id).where(LabOrder.id == lab_result.lab_order_id)
            )
            patient_id = order_q.scalar_one_or_none()
            if patient_id:
                await create_audit_log(
                    session=self.session,
                    user_id=doctor_id,
                    action="lab_result_approved",
                    resource_type="patient",
                    resource_id=patient_id,
                    clinic_id=clinic_id,
                    new_values={"visible_to_patient": visible, "lab_result_id": str(result_id)},
                    ip_address=ip_address,
                    user_agent=user_agent,
                )

        return lab_result

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
