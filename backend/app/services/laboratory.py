from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.laboratory import (
    LabTestCatalog,
    LabOrder,
    LabResult,
    LabOrderStatus,
    LabResultStatus,
    LabOrderPriority,
)
from app.models.patient import Patient
from app.models.user import User
from app.schemas.laboratory import (
    LabTestCatalogCreate,
    LabOrderCreate,
    LabOrderUpdate,
    LabOrderOut,
    LabResultCreate,
    LabResultUpdate,
    LabResultOut,
    LabStatsOut,
)


class LaboratoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Catalog ──────────────────────────────────────────────

    async def get_catalog(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
    ) -> list[LabTestCatalog]:
        stmt = select(LabTestCatalog).where(
            LabTestCatalog.clinic_id == clinic_id,
            LabTestCatalog.is_deleted == False,
        )
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                LabTestCatalog.name.ilike(pattern)
                | LabTestCatalog.code.ilike(pattern)
            )
        if category:
            stmt = stmt.where(LabTestCatalog.category == category)
        stmt = stmt.order_by(LabTestCatalog.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_test(
        self, clinic_id: uuid.UUID, data: LabTestCatalogCreate
    ) -> LabTestCatalog:
        test = LabTestCatalog(clinic_id=clinic_id, **data.model_dump())
        self.session.add(test)
        await self.session.commit()
        await self.session.refresh(test)
        return test

    async def update_test(
        self,
        test_id: uuid.UUID,
        clinic_id: uuid.UUID,
        data: LabTestCatalogCreate,
    ) -> LabTestCatalog | None:
        stmt = select(LabTestCatalog).where(
            LabTestCatalog.id == test_id,
            LabTestCatalog.clinic_id == clinic_id,
            LabTestCatalog.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        test = result.scalar_one_or_none()
        if not test:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(test, key, value)
        await self.session.commit()
        await self.session.refresh(test)
        return test

    async def delete_test(
        self, test_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> bool:
        stmt = select(LabTestCatalog).where(
            LabTestCatalog.id == test_id,
            LabTestCatalog.clinic_id == clinic_id,
            LabTestCatalog.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        test = result.scalar_one_or_none()
        if not test:
            return False
        test.is_deleted = True
        await self.session.commit()
        return True

    # ── Orders ───────────────────────────────────────────────

    async def create_order(
        self,
        clinic_id: uuid.UUID,
        doctor_id: uuid.UUID,
        data: LabOrderCreate,
    ) -> LabOrder:
        order = LabOrder(
            clinic_id=clinic_id,
            ordered_by_id=doctor_id,
            patient_id=data.patient_id,
            test_id=data.test_id,
            priority=LabOrderPriority(data.priority),
            status=LabOrderStatus.ORDERED,
            notes=data.notes,
            expected_at=data.expected_at,
        )
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def get_orders(
        self,
        clinic_id: uuid.UUID,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
        priority: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[LabOrderOut]:
        stmt = (
            select(LabOrder)
            .where(
                LabOrder.clinic_id == clinic_id,
                LabOrder.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(LabOrder.created_at.desc())
        )
        if patient_id:
            stmt = stmt.where(LabOrder.patient_id == patient_id)
        if status:
            stmt = stmt.where(LabOrder.status == LabOrderStatus(status))
        if priority:
            stmt = stmt.where(LabOrder.priority == LabOrderPriority(priority))

        result = await self.session.execute(stmt)
        orders = result.scalars().all()

        out: list[LabOrderOut] = []
        for o in orders:
            patient = o.patient
            test = o.test
            doctor = o.ordered_by
            out.append(
                LabOrderOut(
                    id=o.id,
                    patient_id=o.patient_id,
                    patient_name=(
                        f"{patient.last_name} {patient.first_name}"
                        if patient
                        else None
                    ),
                    test_id=o.test_id,
                    test_name=test.name if test else None,
                    test_code=test.code if test else None,
                    status=o.status.value,
                    priority=o.priority.value,
                    notes=o.notes,
                    ordered_at=o.created_at,
                    expected_at=o.expected_at,
                    collected_at=o.collected_at,
                    doctor_name=(
                        f"{doctor.last_name} {doctor.first_name}"
                        if doctor
                        else None
                    ),
                )
            )
        return out

    async def get_order(
        self, order_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> LabOrderOut | None:
        stmt = select(LabOrder).where(
            LabOrder.id == order_id,
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        o = result.scalar_one_or_none()
        if not o:
            return None
        patient = o.patient
        test = o.test
        doctor = o.ordered_by
        return LabOrderOut(
            id=o.id,
            patient_id=o.patient_id,
            patient_name=(
                f"{patient.last_name} {patient.first_name}"
                if patient
                else None
            ),
            test_id=o.test_id,
            test_name=test.name if test else None,
            test_code=test.code if test else None,
            status=o.status.value,
            priority=o.priority.value,
            notes=o.notes,
            ordered_at=o.created_at,
            expected_at=o.expected_at,
            collected_at=o.collected_at,
            doctor_name=(
                f"{doctor.last_name} {doctor.first_name}"
                if doctor
                else None
            ),
        )

    async def update_order(
        self,
        order_id: uuid.UUID,
        clinic_id: uuid.UUID,
        data: LabOrderUpdate,
    ) -> LabOrderOut | None:
        stmt = select(LabOrder).where(
            LabOrder.id == order_id,
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            return None

        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data:
            new_status = LabOrderStatus(update_data["status"])
            if new_status == LabOrderStatus.SAMPLE_COLLECTED and not order.collected_at:
                order.collected_at = datetime.now(timezone.utc)
            update_data["status"] = new_status

        if "priority" in update_data:
            update_data["priority"] = LabOrderPriority(update_data["priority"])

        for key, value in update_data.items():
            setattr(order, key, value)

        await self.session.commit()
        await self.session.refresh(order)
        return await self.get_order(order_id, clinic_id)

    # ── Results ──────────────────────────────────────────────

    async def create_result(
        self, clinic_id: uuid.UUID, data: LabResultCreate
    ) -> LabResult:
        # Verify order exists and belongs to clinic
        stmt = select(LabOrder).where(
            LabOrder.id == data.lab_order_id,
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            raise ValueError("Lab order not found")

        lab_result = LabResult(
            clinic_id=clinic_id,
            lab_order_id=data.lab_order_id,
            value=data.value,
            numeric_value=data.numeric_value,
            unit=data.unit,
            reference_range=data.reference_range,
            is_abnormal=data.is_abnormal,
            notes=data.notes,
            status=LabResultStatus(data.status),
            resulted_at=datetime.now(timezone.utc),
        )
        self.session.add(lab_result)

        # Update order status to COMPLETED
        order.status = LabOrderStatus.COMPLETED
        await self.session.commit()
        await self.session.refresh(lab_result)
        return lab_result

    async def update_result(
        self,
        result_id: uuid.UUID,
        clinic_id: uuid.UUID,
        data: LabResultUpdate,
    ) -> LabResult | None:
        stmt = select(LabResult).where(
            LabResult.id == result_id,
            LabResult.clinic_id == clinic_id,
            LabResult.is_deleted == False,
        )
        result = await self.session.execute(stmt)
        lab_result = result.scalar_one_or_none()
        if not lab_result:
            return None

        update_data = data.model_dump(exclude_unset=True)
        if "status" in update_data:
            update_data["status"] = LabResultStatus(update_data["status"])

        for key, value in update_data.items():
            setattr(lab_result, key, value)

        await self.session.commit()
        await self.session.refresh(lab_result)
        return lab_result

    async def get_results(
        self,
        clinic_id: uuid.UUID,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[LabResultOut]:
        stmt = (
            select(LabResult)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .where(
                LabResult.clinic_id == clinic_id,
                LabResult.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(LabResult.created_at.desc())
        )
        if patient_id:
            stmt = stmt.where(LabOrder.patient_id == patient_id)
        if status:
            stmt = stmt.where(LabResult.status == LabResultStatus(status))

        result = await self.session.execute(stmt)
        results = result.scalars().all()

        out: list[LabResultOut] = []
        for r in results:
            order = r.lab_order
            test = order.test if order else None
            patient = order.patient if order else None
            out.append(
                LabResultOut(
                    id=r.id,
                    lab_order_id=r.lab_order_id,
                    value=r.value,
                    numeric_value=float(r.numeric_value) if r.numeric_value is not None else None,
                    unit=r.unit,
                    reference_range=r.reference_range,
                    is_abnormal=r.is_abnormal,
                    notes=r.notes,
                    status=r.status.value,
                    visible_to_patient=r.visible_to_patient,
                    resulted_at=r.resulted_at,
                    approved_at=r.approved_at,
                    approved_by_id=r.approved_by_id,
                    test_name=test.name if test else None,
                    test_code=test.code if test else None,
                    patient_name=(
                        f"{patient.last_name} {patient.first_name}"
                        if patient
                        else None
                    ),
                )
            )
        return out

    # ── Stats ────────────────────────────────────────────────

    async def get_stats(self, clinic_id: uuid.UUID) -> LabStatsOut:
        base = and_(
            LabOrder.clinic_id == clinic_id,
            LabOrder.is_deleted == False,
        )

        # Total orders
        total_q = select(func.count(LabOrder.id)).where(base)
        total = (await self.session.execute(total_q)).scalar() or 0

        # Pending (ORDERED + SAMPLE_COLLECTED)
        pending_q = select(func.count(LabOrder.id)).where(
            base,
            LabOrder.status.in_([LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED]),
        )
        pending = (await self.session.execute(pending_q)).scalar() or 0

        # In progress
        in_progress_q = select(func.count(LabOrder.id)).where(
            base,
            LabOrder.status == LabOrderStatus.IN_PROGRESS,
        )
        in_progress = (await self.session.execute(in_progress_q)).scalar() or 0

        # Completed today
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        completed_q = select(func.count(LabOrder.id)).where(
            base,
            LabOrder.status == LabOrderStatus.COMPLETED,
            LabOrder.updated_at >= today_start,
        )
        completed_today = (await self.session.execute(completed_q)).scalar() or 0

        # Urgent pending
        urgent_q = select(func.count(LabOrder.id)).where(
            base,
            LabOrder.priority.in_([LabOrderPriority.URGENT, LabOrderPriority.STAT]),
            LabOrder.status.in_([
                LabOrderStatus.ORDERED,
                LabOrderStatus.SAMPLE_COLLECTED,
                LabOrderStatus.IN_PROGRESS,
            ]),
        )
        urgent_pending = (await self.session.execute(urgent_q)).scalar() or 0

        return LabStatsOut(
            total_orders=total,
            pending_orders=pending,
            in_progress=in_progress,
            completed_today=completed_today,
            urgent_pending=urgent_pending,
        )
