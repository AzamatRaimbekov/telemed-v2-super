from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.treatment import (
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStatus,
    TreatmentItemType,
    TreatmentItemStatus,
)
from app.models.medication import Drug, Prescription, PrescriptionItem, PrescriptionStatus, RouteOfAdministration
from app.models.procedure import Procedure, ProcedureOrder, ProcedureOrderStatus
from app.models.laboratory import LabTestCatalog, LabOrder, LabOrderPriority, LabOrderStatus
from app.models.exercise import Exercise


class TreatmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Catalog queries
    # ------------------------------------------------------------------

    async def get_drug_catalog(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
    ) -> list[Drug]:
        query = select(Drug).where(Drug.clinic_id == clinic_id, Drug.is_deleted == False)
        if search:
            query = query.where(Drug.name.ilike(f"%{search}%"))
        if category:
            query = query.where(Drug.category == category)
        query = query.order_by(Drug.name)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_procedure_catalog(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
    ) -> list[Procedure]:
        query = select(Procedure).where(Procedure.clinic_id == clinic_id, Procedure.is_deleted == False)
        if search:
            query = query.where(Procedure.name.ilike(f"%{search}%"))
        if category:
            query = query.where(Procedure.category == category)
        query = query.order_by(Procedure.name)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_lab_test_catalog(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
    ) -> list[LabTestCatalog]:
        query = select(LabTestCatalog).where(
            LabTestCatalog.clinic_id == clinic_id, LabTestCatalog.is_deleted == False,
        )
        if search:
            query = query.where(LabTestCatalog.name.ilike(f"%{search}%"))
        if category:
            query = query.where(LabTestCatalog.category == category)
        query = query.order_by(LabTestCatalog.name)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_exercise_catalog(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
    ) -> list[Exercise]:
        query = select(Exercise).where(Exercise.clinic_id == clinic_id, Exercise.is_deleted == False)
        if search:
            query = query.where(Exercise.name.ilike(f"%{search}%"))
        if category:
            query = query.where(Exercise.category == category)
        query = query.order_by(Exercise.name)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Plan CRUD
    # ------------------------------------------------------------------

    async def create_plan_with_items(
        self,
        data: dict,
        doctor_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> TreatmentPlan:
        items_data = data.pop("items", [])

        plan = TreatmentPlan(
            id=uuid.uuid4(),
            patient_id=data["patient_id"],
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            title=data["title"],
            description=data.get("description"),
            status=TreatmentPlanStatus(data.get("status", "DRAFT")),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
        )
        self.session.add(plan)
        await self.session.flush()

        for idx, item_data in enumerate(items_data):
            item = TreatmentPlanItem(
                id=uuid.uuid4(),
                treatment_plan_id=plan.id,
                clinic_id=clinic_id,
                item_type=TreatmentItemType(item_data["item_type"]),
                title=item_data["title"],
                description=item_data.get("description"),
                configuration=item_data.get("configuration"),
                frequency=item_data.get("frequency"),
                start_date=item_data.get("start_date"),
                end_date=item_data.get("end_date"),
                sort_order=item_data.get("sort_order", idx),
                assigned_to_id=item_data.get("assigned_to_id"),
                status=TreatmentItemStatus.PENDING,
            )
            self.session.add(item)

        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def get_plan_detail(
        self,
        plan_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> dict:
        query = select(TreatmentPlan).where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.is_deleted == False,
        )
        result = await self.session.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("TreatmentPlan", str(plan_id))

        # Fetch items
        items_q = (
            select(TreatmentPlanItem)
            .where(
                TreatmentPlanItem.treatment_plan_id == plan_id,
                TreatmentPlanItem.is_deleted == False,
            )
            .order_by(TreatmentPlanItem.sort_order)
        )
        items_result = await self.session.execute(items_q)
        items = list(items_result.scalars().all())

        # Collect IDs per type for batch resolution
        drug_ids: set[uuid.UUID] = set()
        procedure_ids: set[uuid.UUID] = set()
        test_ids: set[uuid.UUID] = set()
        exercise_ids: set[uuid.UUID] = set()

        for item in items:
            cfg = item.configuration or {}
            if item.item_type == TreatmentItemType.MEDICATION and cfg.get("drug_id"):
                drug_ids.add(uuid.UUID(str(cfg["drug_id"])))
            elif item.item_type == TreatmentItemType.PROCEDURE and cfg.get("procedure_id"):
                procedure_ids.add(uuid.UUID(str(cfg["procedure_id"])))
            elif item.item_type == TreatmentItemType.LAB_TEST and cfg.get("test_id"):
                test_ids.add(uuid.UUID(str(cfg["test_id"])))
            elif item.item_type == TreatmentItemType.EXERCISE and cfg.get("exercise_id"):
                exercise_ids.add(uuid.UUID(str(cfg["exercise_id"])))

        # Batch fetch related catalog objects
        drugs_map: dict[uuid.UUID, Drug] = {}
        procedures_map: dict[uuid.UUID, Procedure] = {}
        tests_map: dict[uuid.UUID, LabTestCatalog] = {}
        exercises_map: dict[uuid.UUID, Exercise] = {}

        if drug_ids:
            r = await self.session.execute(select(Drug).where(Drug.id.in_(drug_ids)))
            drugs_map = {d.id: d for d in r.scalars().all()}
        if procedure_ids:
            r = await self.session.execute(select(Procedure).where(Procedure.id.in_(procedure_ids)))
            procedures_map = {p.id: p for p in r.scalars().all()}
        if test_ids:
            r = await self.session.execute(select(LabTestCatalog).where(LabTestCatalog.id.in_(test_ids)))
            tests_map = {t.id: t for t in r.scalars().all()}
        if exercise_ids:
            r = await self.session.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
            exercises_map = {e.id: e for e in r.scalars().all()}

        # Build enriched items
        enriched_items = []
        for item in items:
            item_dict = {
                "id": item.id,
                "item_type": item.item_type.value,
                "title": item.title,
                "description": item.description,
                "configuration": item.configuration,
                "frequency": item.frequency,
                "status": item.status.value,
                "sort_order": item.sort_order,
                "start_date": item.start_date,
                "end_date": item.end_date,
                "assigned_to_id": item.assigned_to_id,
                "assigned_to": None,
                "created_at": item.created_at,
            }

            # Resolve assigned_to name
            if item.assigned_to:
                item_dict["assigned_to"] = {
                    "id": item.assigned_to.id,
                    "full_name": f"{item.assigned_to.last_name} {item.assigned_to.first_name}",
                }

            # Enrich with catalog data
            cfg = item.configuration or {}
            if item.item_type == TreatmentItemType.MEDICATION and cfg.get("drug_id"):
                drug = drugs_map.get(uuid.UUID(str(cfg["drug_id"])))
                if drug:
                    item_dict["drug"] = {"id": drug.id, "name": drug.name, "generic_name": drug.generic_name, "form": drug.form.value}
            elif item.item_type == TreatmentItemType.PROCEDURE and cfg.get("procedure_id"):
                proc = procedures_map.get(uuid.UUID(str(cfg["procedure_id"])))
                if proc:
                    item_dict["procedure"] = {"id": proc.id, "name": proc.name, "code": proc.code, "duration_minutes": proc.duration_minutes}
            elif item.item_type == TreatmentItemType.LAB_TEST and cfg.get("test_id"):
                test = tests_map.get(uuid.UUID(str(cfg["test_id"])))
                if test:
                    item_dict["lab_test"] = {"id": test.id, "name": test.name, "code": test.code, "sample_type": test.sample_type}
            elif item.item_type == TreatmentItemType.EXERCISE and cfg.get("exercise_id"):
                ex = exercises_map.get(uuid.UUID(str(cfg["exercise_id"])))
                if ex:
                    item_dict["exercise"] = {"id": ex.id, "name": ex.name, "category": ex.category.value, "difficulty": ex.difficulty.value}

            enriched_items.append(item_dict)

        doctor_info = None
        if plan.doctor:
            doctor_info = {
                "id": plan.doctor.id,
                "full_name": f"{plan.doctor.last_name} {plan.doctor.first_name}",
            }

        return {
            "id": plan.id,
            "patient_id": plan.patient_id,
            "doctor_id": plan.doctor_id,
            "doctor": doctor_info,
            "title": plan.title,
            "description": plan.description,
            "status": plan.status.value,
            "start_date": plan.start_date,
            "end_date": plan.end_date,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
            "items": enriched_items,
        }

    async def update_plan(
        self,
        plan_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
    ) -> TreatmentPlan:
        query = select(TreatmentPlan).where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.is_deleted == False,
        )
        result = await self.session.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("TreatmentPlan", str(plan_id))

        new_status = data.get("status")
        if new_status == "ACTIVE":
            # Validate plan has at least 1 item
            count_q = select(func.count()).select_from(TreatmentPlanItem).where(
                TreatmentPlanItem.treatment_plan_id == plan_id,
                TreatmentPlanItem.is_deleted == False,
            )
            count_result = await self.session.execute(count_q)
            if count_result.scalar_one() < 1:
                raise ValidationError("Cannot activate a plan with no items")

        for key, value in data.items():
            if value is not None and hasattr(plan, key):
                if key == "status":
                    setattr(plan, key, TreatmentPlanStatus(value))
                else:
                    setattr(plan, key, value)

        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def delete_plan(self, plan_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(TreatmentPlan).where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.is_deleted == False,
        )
        result = await self.session.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("TreatmentPlan", str(plan_id))
        plan.is_deleted = True
        await self.session.flush()

    async def activate_plan(
        self,
        plan_id: uuid.UUID,
        doctor_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> TreatmentPlan:
        """Activate a treatment plan and create actual medical orders/prescriptions."""
        query = select(TreatmentPlan).where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.is_deleted == False,
        )
        result = await self.session.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("TreatmentPlan", str(plan_id))

        if plan.status == TreatmentPlanStatus.ACTIVE:
            raise ValidationError("Plan is already active")

        # Get all non-deleted items
        items_q = (
            select(TreatmentPlanItem)
            .where(
                TreatmentPlanItem.treatment_plan_id == plan_id,
                TreatmentPlanItem.is_deleted == False,
            )
            .order_by(TreatmentPlanItem.sort_order)
        )
        items_result = await self.session.execute(items_q)
        items = list(items_result.scalars().all())

        if not items:
            raise ValidationError("Cannot activate a plan with no items")

        now = datetime.now(timezone.utc)

        for item in items:
            cfg = item.configuration or {}

            if item.item_type == TreatmentItemType.MEDICATION:
                drug_id = cfg.get("drug_id")
                if not drug_id:
                    continue

                prescription = Prescription(
                    id=uuid.uuid4(),
                    patient_id=plan.patient_id,
                    doctor_id=doctor_id,
                    treatment_plan_id=plan.id,
                    status=PrescriptionStatus.ACTIVE,
                    notes=cfg.get("notes"),
                    prescribed_at=now,
                    clinic_id=clinic_id,
                )
                self.session.add(prescription)
                await self.session.flush()

                route_val = cfg.get("route", "ORAL")
                try:
                    route = RouteOfAdministration(route_val)
                except ValueError:
                    route = RouteOfAdministration.ORAL

                rx_item = PrescriptionItem(
                    id=uuid.uuid4(),
                    prescription_id=prescription.id,
                    drug_id=uuid.UUID(str(drug_id)),
                    dosage=cfg.get("dosage"),
                    frequency=cfg.get("frequency") or item.frequency,
                    route=route,
                    duration_days=cfg.get("duration_days"),
                    quantity=cfg.get("quantity"),
                    is_prn=cfg.get("is_prn", False),
                    notes=cfg.get("notes"),
                    clinic_id=clinic_id,
                )
                self.session.add(rx_item)

            elif item.item_type == TreatmentItemType.LAB_TEST:
                test_id = cfg.get("test_id")
                if not test_id:
                    continue

                priority_val = cfg.get("priority", "ROUTINE")
                try:
                    priority = LabOrderPriority(priority_val)
                except ValueError:
                    priority = LabOrderPriority.ROUTINE

                lab_order = LabOrder(
                    id=uuid.uuid4(),
                    patient_id=plan.patient_id,
                    ordered_by_id=doctor_id,
                    treatment_plan_id=plan.id,
                    test_id=uuid.UUID(str(test_id)),
                    priority=priority,
                    status=LabOrderStatus.ORDERED,
                    notes=cfg.get("notes"),
                    clinic_id=clinic_id,
                )
                self.session.add(lab_order)

            elif item.item_type == TreatmentItemType.PROCEDURE:
                procedure_id = cfg.get("procedure_id")
                if not procedure_id:
                    continue

                proc_order = ProcedureOrder(
                    id=uuid.uuid4(),
                    patient_id=plan.patient_id,
                    procedure_id=uuid.UUID(str(procedure_id)),
                    ordered_by_id=doctor_id,
                    treatment_plan_id=plan.id,
                    status=ProcedureOrderStatus.ORDERED,
                    scheduled_at=cfg.get("scheduled_at") or item.scheduled_at,
                    notes=cfg.get("notes"),
                    clinic_id=clinic_id,
                )
                self.session.add(proc_order)

            elif item.item_type in (
                TreatmentItemType.EXERCISE,
                TreatmentItemType.THERAPY,
            ):
                # No external records to create; just activate the item below.
                pass

            # Mark item as IN_PROGRESS
            item.status = TreatmentItemStatus.IN_PROGRESS

        plan.status = TreatmentPlanStatus.ACTIVE
        if not plan.start_date:
            plan.start_date = now.date()

        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    # ------------------------------------------------------------------
    # Item CRUD
    # ------------------------------------------------------------------

    async def _get_plan(self, plan_id: uuid.UUID, clinic_id: uuid.UUID) -> TreatmentPlan:
        query = select(TreatmentPlan).where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.is_deleted == False,
        )
        result = await self.session.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("TreatmentPlan", str(plan_id))
        return plan

    async def add_item(
        self,
        plan_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
    ) -> TreatmentPlanItem:
        await self._get_plan(plan_id, clinic_id)

        item = TreatmentPlanItem(
            id=uuid.uuid4(),
            treatment_plan_id=plan_id,
            clinic_id=clinic_id,
            item_type=TreatmentItemType(data["item_type"]),
            title=data["title"],
            description=data.get("description"),
            configuration=data.get("configuration"),
            frequency=data.get("frequency"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            sort_order=data.get("sort_order", 0),
            assigned_to_id=data.get("assigned_to_id"),
            status=TreatmentItemStatus.PENDING,
        )
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def update_item(
        self,
        plan_id: uuid.UUID,
        item_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
    ) -> TreatmentPlanItem:
        await self._get_plan(plan_id, clinic_id)

        query = select(TreatmentPlanItem).where(
            TreatmentPlanItem.id == item_id,
            TreatmentPlanItem.treatment_plan_id == plan_id,
            TreatmentPlanItem.is_deleted == False,
        )
        result = await self.session.execute(query)
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError("TreatmentPlanItem", str(item_id))

        for key, value in data.items():
            if value is not None and hasattr(item, key):
                if key == "item_type":
                    setattr(item, key, TreatmentItemType(value))
                elif key == "status":
                    setattr(item, key, TreatmentItemStatus(value))
                else:
                    setattr(item, key, value)

        await self.session.flush()
        await self.session.refresh(item)
        return item

    async def delete_item(
        self,
        plan_id: uuid.UUID,
        item_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> None:
        await self._get_plan(plan_id, clinic_id)

        query = select(TreatmentPlanItem).where(
            TreatmentPlanItem.id == item_id,
            TreatmentPlanItem.treatment_plan_id == plan_id,
            TreatmentPlanItem.is_deleted == False,
        )
        result = await self.session.execute(query)
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError("TreatmentPlanItem", str(item_id))

        item.is_deleted = True
        await self.session.flush()

    async def reorder_items(
        self,
        plan_id: uuid.UUID,
        item_ids: list[uuid.UUID],
        clinic_id: uuid.UUID,
    ) -> list[TreatmentPlanItem]:
        await self._get_plan(plan_id, clinic_id)

        query = select(TreatmentPlanItem).where(
            TreatmentPlanItem.treatment_plan_id == plan_id,
            TreatmentPlanItem.is_deleted == False,
        )
        result = await self.session.execute(query)
        items = {item.id: item for item in result.scalars().all()}

        for idx, item_id in enumerate(item_ids):
            if item_id in items:
                items[item_id].sort_order = idx

        await self.session.flush()

        # Return ordered items
        ordered = sorted(items.values(), key=lambda i: i.sort_order)
        return ordered
