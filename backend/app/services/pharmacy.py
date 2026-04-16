from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, func, delete, and_, case, literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, ValidationError
from app.models.medication import (
    Drug,
    Inventory,
    InventoryLog,
    InventoryOperationType,
    DispenseRecord,
    Prescription,
    PrescriptionItem,
    PrescriptionStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    Supplier,
)
from app.models.patient import Patient
from app.models.user import User
from app.schemas.pharmacy import (
    DispenseItemRequest,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    ReceiveOrderRequest,
    SupplierCreate,
    SupplierUpdate,
)


class PharmacyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ══════════════════════════════════════════════════════════════════════════
    # Dashboard
    # ══════════════════════════════════════════════════════════════════════════

    async def get_dashboard(self, clinic_id: uuid.UUID) -> dict:
        today = date.today()
        soon = today + timedelta(days=30)

        # Drug count
        drug_count_q = select(func.count()).select_from(Drug).where(
            Drug.clinic_id == clinic_id, Drug.is_deleted == False
        )
        drug_count = (await self.session.execute(drug_count_q)).scalar_one()

        # Total stock value
        value_q = select(
            func.coalesce(func.sum(Inventory.quantity * Inventory.purchase_price), 0)
        ).where(
            Inventory.clinic_id == clinic_id, Inventory.is_deleted == False
        )
        stock_value = float((await self.session.execute(value_q)).scalar_one())

        # Pending prescriptions
        pending_q = select(func.count()).select_from(Prescription).where(
            Prescription.clinic_id == clinic_id,
            Prescription.is_deleted == False,
            Prescription.status == PrescriptionStatus.ACTIVE,
        )
        pending_prescriptions = (await self.session.execute(pending_q)).scalar_one()

        # Expired batches
        expired_q = select(func.count()).select_from(Inventory).where(
            Inventory.clinic_id == clinic_id,
            Inventory.is_deleted == False,
            Inventory.expiry_date < today,
            Inventory.quantity > 0,
        )
        expired_batches = (await self.session.execute(expired_q)).scalar_one()

        # Low stock count (drugs where total quantity <= threshold)
        low_stock_sub = (
            select(
                Inventory.drug_id,
                func.sum(Inventory.quantity).label("total_qty"),
                func.min(Inventory.low_stock_threshold).label("threshold"),
            )
            .where(Inventory.clinic_id == clinic_id, Inventory.is_deleted == False)
            .group_by(Inventory.drug_id)
        ).subquery()
        low_stock_q = select(func.count()).select_from(low_stock_sub).where(
            low_stock_sub.c.total_qty <= low_stock_sub.c.threshold,
            low_stock_sub.c.total_qty > 0,
        )
        low_stock_count = (await self.session.execute(low_stock_q)).scalar_one()

        # Alerts
        alerts: list[dict] = []

        # Expired batches alerts
        expired_inv_q = (
            select(Inventory)
            .join(Drug, Inventory.drug_id == Drug.id)
            .where(
                Inventory.clinic_id == clinic_id,
                Inventory.is_deleted == False,
                Inventory.expiry_date < today,
                Inventory.quantity > 0,
            )
            .options(selectinload(Inventory.drug))
            .limit(10)
        )
        expired_items = (await self.session.execute(expired_inv_q)).scalars().all()
        for inv in expired_items:
            alerts.append({
                "severity": "red",
                "message": f"Истёк срок годности: {inv.drug.name} (партия {inv.batch_number or 'N/A'})",
                "reference_type": "inventory",
                "reference_id": str(inv.id),
            })

        # Expiring soon alerts
        expiring_inv_q = (
            select(Inventory)
            .join(Drug, Inventory.drug_id == Drug.id)
            .where(
                Inventory.clinic_id == clinic_id,
                Inventory.is_deleted == False,
                Inventory.expiry_date >= today,
                Inventory.expiry_date <= soon,
                Inventory.quantity > 0,
            )
            .options(selectinload(Inventory.drug))
            .limit(10)
        )
        expiring_items = (await self.session.execute(expiring_inv_q)).scalars().all()
        for inv in expiring_items:
            alerts.append({
                "severity": "yellow",
                "message": f"Срок годности истекает: {inv.drug.name} ({inv.expiry_date})",
                "reference_type": "inventory",
                "reference_id": str(inv.id),
            })

        # Low stock alerts
        low_stock_detail_q = (
            select(
                Drug.id.label("drug_id"),
                Drug.name.label("drug_name"),
                func.sum(Inventory.quantity).label("total_qty"),
                func.min(Inventory.low_stock_threshold).label("threshold"),
            )
            .join(Drug, Inventory.drug_id == Drug.id)
            .where(Inventory.clinic_id == clinic_id, Inventory.is_deleted == False)
            .group_by(Drug.id, Drug.name)
            .having(
                and_(
                    func.sum(Inventory.quantity) <= func.min(Inventory.low_stock_threshold),
                    func.sum(Inventory.quantity) > 0,
                )
            )
            .limit(10)
        )
        low_stock_items = (await self.session.execute(low_stock_detail_q)).all()
        for row in low_stock_items:
            alerts.append({
                "severity": "yellow",
                "message": f"Низкий остаток: {row.drug_name} ({row.total_qty} шт.)",
                "reference_type": "drug",
                "reference_id": str(row.drug_id),
            })

        # New prescriptions alerts
        if pending_prescriptions > 0:
            alerts.append({
                "severity": "blue",
                "message": f"Новых рецептов к выдаче: {pending_prescriptions}",
                "reference_type": "prescriptions",
                "reference_id": None,
            })

        # Recent operations (last 10 inventory logs)
        logs_q = (
            select(InventoryLog)
            .where(InventoryLog.clinic_id == clinic_id, InventoryLog.is_deleted == False)
            .order_by(InventoryLog.created_at.desc())
            .limit(10)
        )
        logs = list((await self.session.execute(logs_q)).scalars().all())
        recent_operations = []
        for log in logs:
            recent_operations.append({
                "id": str(log.id),
                "operation_type": log.operation_type.value,
                "quantity_change": log.quantity_change,
                "reason": log.reason,
                "performed_by": str(log.performed_by),
                "performer_name": (
                    f"{log.performer.last_name} {log.performer.first_name}"
                    if log.performer else None
                ),
                "created_at": log.created_at.isoformat() if log.created_at else None,
            })

        return {
            "stats": {
                "drug_count": drug_count,
                "stock_value": stock_value,
                "pending_prescriptions": pending_prescriptions,
                "expired_batches": expired_batches,
                "low_stock_count": low_stock_count,
            },
            "alerts": alerts,
            "recent_operations": recent_operations,
        }

    # ══════════════════════════════════════════════════════════════════════════
    # Inventory
    # ══════════════════════════════════════════════════════════════════════════

    async def list_inventory(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        category: str | None = None,
        form: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        today = date.today()

        base_filters = [Inventory.clinic_id == clinic_id, Inventory.is_deleted == False]

        # Build a subquery to aggregate inventory per drug
        agg_q = (
            select(
                Inventory.drug_id,
                func.sum(Inventory.quantity).label("total_quantity"),
                func.min(Inventory.low_stock_threshold).label("low_stock_threshold"),
                func.min(Inventory.expiry_date).label("nearest_expiry"),
                func.bool_or(
                    and_(Inventory.expiry_date < today, Inventory.quantity > 0)
                ).label("has_expired"),
            )
            .where(*base_filters)
            .group_by(Inventory.drug_id)
        ).subquery()

        # Join with Drug
        drug_filters = [Drug.is_deleted == False]
        if search:
            drug_filters.append(Drug.name.ilike(f"%{search}%"))
        if category:
            drug_filters.append(Drug.category == category)
        if form:
            drug_filters.append(Drug.form == form)

        joined_q = (
            select(
                Drug.id.label("drug_id"),
                Drug.name.label("drug_name"),
                Drug.generic_name,
                Drug.form,
                Drug.category,
                func.coalesce(agg_q.c.total_quantity, 0).label("total_quantity"),
                func.coalesce(agg_q.c.low_stock_threshold, 10).label("low_stock_threshold"),
                agg_q.c.nearest_expiry,
                func.coalesce(agg_q.c.has_expired, False).label("has_expired"),
            )
            .outerjoin(agg_q, Drug.id == agg_q.c.drug_id)
            .where(Drug.clinic_id == clinic_id, *drug_filters)
        )

        # Count total before pagination
        count_q = select(func.count()).select_from(joined_q.subquery())
        total = (await self.session.execute(count_q)).scalar_one()

        # Get items
        items_q = joined_q.order_by(Drug.name).offset(skip).limit(limit)
        rows = (await self.session.execute(items_q)).all()

        items = []
        for row in rows:
            total_qty = row.total_quantity
            threshold = row.low_stock_threshold
            has_expired = row.has_expired

            if has_expired:
                row_status = "expired"
            elif total_qty == 0:
                row_status = "out"
            elif total_qty <= threshold:
                row_status = "low"
            else:
                row_status = "ok"

            # Filter by status if requested
            if status and row_status != status:
                continue

            items.append({
                "drug_id": str(row.drug_id),
                "drug_name": row.drug_name,
                "generic_name": row.generic_name,
                "form": row.form.value if row.form else None,
                "category": row.category,
                "total_quantity": total_qty,
                "low_stock_threshold": threshold,
                "nearest_expiry": row.nearest_expiry.isoformat() if row.nearest_expiry else None,
                "status": row_status,
            })

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def get_batches(self, clinic_id: uuid.UUID, drug_id: uuid.UUID) -> list[dict]:
        q = (
            select(Inventory)
            .where(
                Inventory.clinic_id == clinic_id,
                Inventory.drug_id == drug_id,
                Inventory.is_deleted == False,
            )
            .order_by(Inventory.expiry_date.asc().nullslast())
        )
        batches = list((await self.session.execute(q)).scalars().all())
        return [
            {
                "id": str(b.id),
                "batch_number": b.batch_number,
                "quantity": b.quantity,
                "purchase_price": float(b.purchase_price) if b.purchase_price is not None else None,
                "supplier_name": b.supplier.name if b.supplier else None,
                "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in batches
        ]

    async def write_off(
        self,
        clinic_id: uuid.UUID,
        inventory_id: uuid.UUID,
        quantity: int,
        reason: str,
        user_id: uuid.UUID,
    ) -> dict:
        inv = await self._get_inventory(clinic_id, inventory_id)
        if quantity > inv.quantity:
            raise ValidationError(f"Cannot write off {quantity}, only {inv.quantity} available")

        inv.quantity -= quantity

        log = InventoryLog(
            clinic_id=clinic_id,
            inventory_id=inventory_id,
            operation_type=InventoryOperationType.WRITE_OFF,
            quantity_change=-quantity,
            reason=reason,
            performed_by=user_id,
        )
        self.session.add(log)
        await self.session.flush()

        return {"ok": True, "new_quantity": inv.quantity}

    async def adjust(
        self,
        clinic_id: uuid.UUID,
        inventory_id: uuid.UUID,
        new_quantity: int,
        reason: str,
        user_id: uuid.UUID,
    ) -> dict:
        inv = await self._get_inventory(clinic_id, inventory_id)
        old_quantity = inv.quantity
        change = new_quantity - old_quantity
        inv.quantity = new_quantity

        log = InventoryLog(
            clinic_id=clinic_id,
            inventory_id=inventory_id,
            operation_type=InventoryOperationType.ADJUSTMENT,
            quantity_change=change,
            reason=reason,
            performed_by=user_id,
        )
        self.session.add(log)
        await self.session.flush()

        return {"ok": True, "old_quantity": old_quantity, "new_quantity": new_quantity}

    async def _get_inventory(self, clinic_id: uuid.UUID, inventory_id: uuid.UUID) -> Inventory:
        q = select(Inventory).where(
            Inventory.id == inventory_id,
            Inventory.clinic_id == clinic_id,
            Inventory.is_deleted == False,
        )
        inv = (await self.session.execute(q)).scalar_one_or_none()
        if not inv:
            raise NotFoundError("Inventory")
        return inv

    # ══════════════════════════════════════════════════════════════════════════
    # Dispensing
    # ══════════════════════════════════════════════════════════════════════════

    async def get_prescription_queue(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        date_filter: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        base = [
            Prescription.clinic_id == clinic_id,
            Prescription.is_deleted == False,
            Prescription.status.in_([PrescriptionStatus.ACTIVE, PrescriptionStatus.PARTIALLY_DISPENSED]),
        ]

        if date_filter:
            try:
                filter_date = date.fromisoformat(date_filter)
                base.append(func.date(Prescription.prescribed_at) == filter_date)
            except ValueError:
                pass

        q = (
            select(Prescription)
            .join(Patient, Prescription.patient_id == Patient.id)
            .join(User, Prescription.doctor_id == User.id)
            .where(*base)
        )

        if search:
            q = q.where(
                (Patient.first_name.ilike(f"%{search}%"))
                | (Patient.last_name.ilike(f"%{search}%"))
                | (User.first_name.ilike(f"%{search}%"))
                | (User.last_name.ilike(f"%{search}%"))
            )

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.session.execute(count_q)).scalar_one()

        q = q.order_by(Prescription.prescribed_at.desc().nullslast()).offset(skip).limit(limit)
        prescriptions = list((await self.session.execute(q)).scalars().all())

        items = []
        for p in prescriptions:
            patient = p.patient
            doctor = p.doctor
            items.append({
                "id": str(p.id),
                "patient_name": f"{patient.last_name} {patient.first_name}" if patient else "N/A",
                "doctor_name": f"{doctor.last_name} {doctor.first_name}" if doctor else "N/A",
                "prescribed_at": p.prescribed_at.isoformat() if p.prescribed_at else None,
                "items_count": len(p.items) if p.items else 0,
                "status": p.status.value,
            })

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def get_prescription_detail(
        self, clinic_id: uuid.UUID, prescription_id: uuid.UUID
    ) -> dict:
        q = select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.clinic_id == clinic_id,
            Prescription.is_deleted == False,
        )
        prescription = (await self.session.execute(q)).scalar_one_or_none()
        if not prescription:
            raise NotFoundError("Prescription")

        patient = prescription.patient
        doctor = prescription.doctor

        items_out = []
        for item in (prescription.items or []):
            drug = item.drug

            # Available stock
            stock_q = select(func.coalesce(func.sum(Inventory.quantity), 0)).where(
                Inventory.clinic_id == clinic_id,
                Inventory.drug_id == item.drug_id,
                Inventory.is_deleted == False,
                Inventory.quantity > 0,
            )
            available_stock = (await self.session.execute(stock_q)).scalar_one()

            # Already dispensed for this item
            dispensed_q = select(func.coalesce(func.sum(DispenseRecord.quantity), 0)).where(
                DispenseRecord.prescription_item_id == item.id,
                DispenseRecord.is_deleted == False,
            )
            already_dispensed = (await self.session.execute(dispensed_q)).scalar_one()

            # Suggested batch (FIFO - nearest expiry with quantity > 0)
            batch_q = (
                select(Inventory)
                .where(
                    Inventory.clinic_id == clinic_id,
                    Inventory.drug_id == item.drug_id,
                    Inventory.is_deleted == False,
                    Inventory.quantity > 0,
                )
                .order_by(Inventory.expiry_date.asc().nullslast())
                .limit(1)
            )
            suggested_batch = (await self.session.execute(batch_q)).scalar_one_or_none()

            items_out.append({
                "id": str(item.id),
                "drug_id": str(item.drug_id),
                "drug_name": drug.name if drug else "N/A",
                "dosage": item.dosage,
                "frequency": item.frequency,
                "quantity": item.quantity,
                "already_dispensed": already_dispensed,
                "available_stock": available_stock,
                "suggested_batch_id": str(suggested_batch.id) if suggested_batch else None,
                "suggested_batch_number": suggested_batch.batch_number if suggested_batch else None,
                "suggested_batch_expiry": (
                    suggested_batch.expiry_date.isoformat() if suggested_batch and suggested_batch.expiry_date else None
                ),
            })

        return {
            "id": str(prescription.id),
            "patient_name": f"{patient.last_name} {patient.first_name}" if patient else "N/A",
            "doctor_name": f"{doctor.last_name} {doctor.first_name}" if doctor else "N/A",
            "prescribed_at": prescription.prescribed_at.isoformat() if prescription.prescribed_at else None,
            "status": prescription.status.value,
            "notes": prescription.notes,
            "items": items_out,
        }

    async def dispense(
        self,
        clinic_id: uuid.UUID,
        prescription_id: uuid.UUID,
        items: list[DispenseItemRequest],
        user_id: uuid.UUID,
    ) -> dict:
        # Get prescription
        q = select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.clinic_id == clinic_id,
            Prescription.is_deleted == False,
        )
        prescription = (await self.session.execute(q)).scalar_one_or_none()
        if not prescription:
            raise NotFoundError("Prescription")

        if prescription.status not in (PrescriptionStatus.ACTIVE, PrescriptionStatus.PARTIALLY_DISPENSED):
            raise ValidationError(f"Cannot dispense prescription with status {prescription.status.value}")

        dispensed_records = []

        for item_req in items:
            # Verify prescription item belongs to this prescription
            pi_q = select(PrescriptionItem).where(
                PrescriptionItem.id == item_req.prescription_item_id,
                PrescriptionItem.prescription_id == prescription_id,
            )
            pi = (await self.session.execute(pi_q)).scalar_one_or_none()
            if not pi:
                raise NotFoundError("PrescriptionItem", str(item_req.prescription_item_id))

            # Find inventory batch (FIFO if not specified)
            if item_req.inventory_id:
                inv = await self._get_inventory(clinic_id, item_req.inventory_id)
            else:
                # FIFO: select batch with nearest expiry_date that has quantity > 0
                fifo_q = (
                    select(Inventory)
                    .where(
                        Inventory.clinic_id == clinic_id,
                        Inventory.drug_id == pi.drug_id,
                        Inventory.is_deleted == False,
                        Inventory.quantity > 0,
                    )
                    .order_by(Inventory.expiry_date.asc().nullslast())
                    .limit(1)
                )
                inv = (await self.session.execute(fifo_q)).scalar_one_or_none()
                if not inv:
                    raise ValidationError(f"No stock available for drug {pi.drug.name if pi.drug else pi.drug_id}")

            if item_req.quantity > inv.quantity:
                raise ValidationError(
                    f"Insufficient stock in batch {inv.batch_number or inv.id}: "
                    f"requested {item_req.quantity}, available {inv.quantity}"
                )

            # Decrease inventory
            inv.quantity -= item_req.quantity

            # Create dispense record
            record = DispenseRecord(
                clinic_id=clinic_id,
                prescription_item_id=item_req.prescription_item_id,
                inventory_id=inv.id,
                quantity=item_req.quantity,
                dispensed_by=user_id,
            )
            self.session.add(record)

            # Create inventory log
            log = InventoryLog(
                clinic_id=clinic_id,
                inventory_id=inv.id,
                operation_type=InventoryOperationType.DISPENSE,
                quantity_change=-item_req.quantity,
                reason=f"Dispensed for prescription {prescription_id}",
                reference_type="prescription",
                reference_id=prescription_id,
                performed_by=user_id,
            )
            self.session.add(log)

            dispensed_records.append({
                "prescription_item_id": str(item_req.prescription_item_id),
                "inventory_id": str(inv.id),
                "quantity": item_req.quantity,
            })

        # Determine new prescription status
        all_fully_dispensed = True
        any_dispensed = False

        for pi in (prescription.items or []):
            dispensed_sum_q = select(func.coalesce(func.sum(DispenseRecord.quantity), 0)).where(
                DispenseRecord.prescription_item_id == pi.id,
                DispenseRecord.is_deleted == False,
            )
            total_dispensed = (await self.session.execute(dispensed_sum_q)).scalar_one()
            required = pi.quantity or 0
            if total_dispensed > 0:
                any_dispensed = True
            if required > 0 and total_dispensed < required:
                all_fully_dispensed = False

        if all_fully_dispensed and any_dispensed:
            prescription.status = PrescriptionStatus.DISPENSED
        elif any_dispensed:
            prescription.status = PrescriptionStatus.PARTIALLY_DISPENSED

        await self.session.flush()

        return {
            "ok": True,
            "status": prescription.status.value,
            "dispensed": dispensed_records,
        }

    # ══════════════════════════════════════════════════════════════════════════
    # Purchase Orders
    # ══════════════════════════════════════════════════════════════════════════

    async def list_orders(
        self,
        clinic_id: uuid.UUID,
        status: str | None = None,
        supplier_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        base = [PurchaseOrder.clinic_id == clinic_id, PurchaseOrder.is_deleted == False]
        if status:
            base.append(PurchaseOrder.status == PurchaseOrderStatus(status))
        if supplier_id:
            base.append(PurchaseOrder.supplier_id == supplier_id)

        count_q = select(func.count()).select_from(PurchaseOrder).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        q = (
            select(PurchaseOrder)
            .where(*base)
            .order_by(PurchaseOrder.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        orders = list((await self.session.execute(q)).scalars().all())

        items = []
        for o in orders:
            items.append({
                "id": str(o.id),
                "supplier_name": o.supplier.name if o.supplier else None,
                "supplier_id": str(o.supplier_id),
                "status": o.status.value,
                "total_amount": float(o.total_amount) if o.total_amount else None,
                "items_count": len(o.order_items) if o.order_items else 0,
                "notes": o.notes,
                "ordered_by_name": (
                    f"{o.ordered_by.last_name} {o.ordered_by.first_name}" if o.ordered_by else None
                ),
                "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
                "received_at": o.received_at.isoformat() if o.received_at else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            })

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def get_order(self, clinic_id: uuid.UUID, order_id: uuid.UUID) -> dict:
        order = await self._get_order(clinic_id, order_id)
        order_items = []
        for oi in (order.order_items or []):
            order_items.append({
                "id": str(oi.id),
                "drug_id": str(oi.drug_id),
                "drug_name": oi.drug.name if oi.drug else None,
                "quantity_ordered": oi.quantity_ordered,
                "quantity_received": oi.quantity_received,
                "unit_price": float(oi.unit_price) if oi.unit_price is not None else None,
            })

        return {
            "id": str(order.id),
            "supplier_id": str(order.supplier_id),
            "supplier_name": order.supplier.name if order.supplier else None,
            "status": order.status.value,
            "total_amount": float(order.total_amount) if order.total_amount else None,
            "notes": order.notes,
            "ordered_by_name": (
                f"{order.ordered_by.last_name} {order.ordered_by.first_name}" if order.ordered_by else None
            ),
            "ordered_at": order.ordered_at.isoformat() if order.ordered_at else None,
            "received_at": order.received_at.isoformat() if order.received_at else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": order_items,
        }

    async def create_order(
        self, clinic_id: uuid.UUID, data: PurchaseOrderCreate, user_id: uuid.UUID
    ) -> dict:
        # Calculate total
        total_amount = sum(
            (item.unit_price or 0) * item.quantity_ordered for item in data.items
        )

        order = PurchaseOrder(
            clinic_id=clinic_id,
            supplier_id=data.supplier_id,
            ordered_by_id=user_id,
            status=PurchaseOrderStatus.DRAFT,
            total_amount=total_amount if total_amount > 0 else None,
            notes=data.notes,
        )
        self.session.add(order)
        await self.session.flush()

        for item_data in data.items:
            oi = PurchaseOrderItem(
                clinic_id=clinic_id,
                purchase_order_id=order.id,
                drug_id=item_data.drug_id,
                quantity_ordered=item_data.quantity_ordered,
                quantity_received=0,
                unit_price=item_data.unit_price,
            )
            self.session.add(oi)

        await self.session.flush()
        await self.session.refresh(order)

        return await self.get_order(clinic_id, order.id)

    async def update_order(
        self, clinic_id: uuid.UUID, order_id: uuid.UUID, data: PurchaseOrderUpdate
    ) -> dict:
        order = await self._get_order(clinic_id, order_id)
        if order.status != PurchaseOrderStatus.DRAFT:
            raise ValidationError("Can only update draft orders")

        if data.supplier_id is not None:
            order.supplier_id = data.supplier_id
        if data.notes is not None:
            order.notes = data.notes

        if data.items is not None:
            # Remove old items
            for oi in list(order.order_items or []):
                await self.session.delete(oi)
            await self.session.flush()

            total_amount = 0.0
            for item_data in data.items:
                oi = PurchaseOrderItem(
                    clinic_id=clinic_id,
                    purchase_order_id=order.id,
                    drug_id=item_data.drug_id,
                    quantity_ordered=item_data.quantity_ordered,
                    quantity_received=0,
                    unit_price=item_data.unit_price,
                )
                self.session.add(oi)
                total_amount += (item_data.unit_price or 0) * item_data.quantity_ordered

            order.total_amount = total_amount if total_amount > 0 else None

        await self.session.flush()
        await self.session.refresh(order)

        return await self.get_order(clinic_id, order.id)

    async def submit_order(self, clinic_id: uuid.UUID, order_id: uuid.UUID) -> dict:
        order = await self._get_order(clinic_id, order_id)
        if order.status != PurchaseOrderStatus.DRAFT:
            raise ValidationError("Can only submit draft orders")

        order.status = PurchaseOrderStatus.SUBMITTED
        order.ordered_at = datetime.now(timezone.utc)
        await self.session.flush()

        return {"ok": True, "status": order.status.value}

    async def receive_order(
        self,
        clinic_id: uuid.UUID,
        order_id: uuid.UUID,
        data: ReceiveOrderRequest,
        user_id: uuid.UUID,
    ) -> dict:
        order = await self._get_order(clinic_id, order_id)
        if order.status not in (PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.DRAFT):
            raise ValidationError("Can only receive submitted or draft orders")

        for item_req in data.items:
            # Find the purchase order item
            poi_q = select(PurchaseOrderItem).where(
                PurchaseOrderItem.id == item_req.purchase_order_item_id,
                PurchaseOrderItem.purchase_order_id == order_id,
            )
            poi = (await self.session.execute(poi_q)).scalar_one_or_none()
            if not poi:
                raise NotFoundError("PurchaseOrderItem", str(item_req.purchase_order_item_id))

            poi.quantity_received += item_req.quantity_received

            # Create inventory batch
            inv = Inventory(
                clinic_id=clinic_id,
                drug_id=poi.drug_id,
                quantity=item_req.quantity_received,
                batch_number=item_req.batch_number,
                expiry_date=item_req.expiry_date,
                purchase_price=poi.unit_price,
                supplier_id=order.supplier_id,
            )
            self.session.add(inv)
            await self.session.flush()

            # Create inventory log
            log = InventoryLog(
                clinic_id=clinic_id,
                inventory_id=inv.id,
                operation_type=InventoryOperationType.RECEIPT,
                quantity_change=item_req.quantity_received,
                reason=f"Received from PO #{order_id}",
                reference_type="purchase_order",
                reference_id=order_id,
                performed_by=user_id,
            )
            self.session.add(log)

        order.status = PurchaseOrderStatus.RECEIVED
        order.received_at = datetime.now(timezone.utc)
        await self.session.flush()

        return {"ok": True, "status": order.status.value}

    async def cancel_order(self, clinic_id: uuid.UUID, order_id: uuid.UUID) -> dict:
        order = await self._get_order(clinic_id, order_id)
        if order.status not in (PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SUBMITTED):
            raise ValidationError("Can only cancel draft or submitted orders")

        order.status = PurchaseOrderStatus.CANCELLED
        await self.session.flush()

        return {"ok": True, "status": order.status.value}

    async def _get_order(self, clinic_id: uuid.UUID, order_id: uuid.UUID) -> PurchaseOrder:
        q = select(PurchaseOrder).where(
            PurchaseOrder.id == order_id,
            PurchaseOrder.clinic_id == clinic_id,
            PurchaseOrder.is_deleted == False,
        )
        order = (await self.session.execute(q)).scalar_one_or_none()
        if not order:
            raise NotFoundError("PurchaseOrder")
        return order

    # ══════════════════════════════════════════════════════════════════════════
    # Suppliers
    # ══════════════════════════════════════════════════════════════════════════

    async def list_suppliers(
        self,
        clinic_id: uuid.UUID,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> dict:
        base = [Supplier.clinic_id == clinic_id, Supplier.is_deleted == False]
        if search:
            base.append(Supplier.name.ilike(f"%{search}%"))

        count_q = select(func.count()).select_from(Supplier).where(*base)
        total = (await self.session.execute(count_q)).scalar_one()

        # Supplier with order count
        order_count_sub = (
            select(
                PurchaseOrder.supplier_id,
                func.count(PurchaseOrder.id).label("order_count"),
            )
            .where(PurchaseOrder.clinic_id == clinic_id, PurchaseOrder.is_deleted == False)
            .group_by(PurchaseOrder.supplier_id)
        ).subquery()

        q = (
            select(
                Supplier,
                func.coalesce(order_count_sub.c.order_count, 0).label("order_count"),
            )
            .outerjoin(order_count_sub, Supplier.id == order_count_sub.c.supplier_id)
            .where(*base)
            .order_by(Supplier.name)
            .offset(skip)
            .limit(limit)
        )
        rows = (await self.session.execute(q)).all()

        items = []
        for supplier, order_count in rows:
            items.append({
                "id": str(supplier.id),
                "name": supplier.name,
                "contact_person": supplier.contact_person,
                "phone": supplier.phone,
                "email": supplier.email,
                "address": supplier.address,
                "order_count": order_count,
                "created_at": supplier.created_at.isoformat() if supplier.created_at else None,
            })

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def create_supplier(
        self, clinic_id: uuid.UUID, data: SupplierCreate
    ) -> dict:
        supplier = Supplier(
            clinic_id=clinic_id,
            name=data.name,
            contact_person=data.contact_person,
            phone=data.phone,
            email=data.email,
            address=data.address,
        )
        self.session.add(supplier)
        await self.session.flush()
        await self.session.refresh(supplier)

        return {
            "id": str(supplier.id),
            "name": supplier.name,
            "contact_person": supplier.contact_person,
            "phone": supplier.phone,
            "email": supplier.email,
            "address": supplier.address,
        }

    async def update_supplier(
        self, clinic_id: uuid.UUID, supplier_id: uuid.UUID, data: SupplierUpdate
    ) -> dict:
        supplier = await self._get_supplier(clinic_id, supplier_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(supplier, key, value)

        await self.session.flush()
        await self.session.refresh(supplier)

        return {
            "id": str(supplier.id),
            "name": supplier.name,
            "contact_person": supplier.contact_person,
            "phone": supplier.phone,
            "email": supplier.email,
            "address": supplier.address,
        }

    async def delete_supplier(self, clinic_id: uuid.UUID, supplier_id: uuid.UUID) -> None:
        supplier = await self._get_supplier(clinic_id, supplier_id)

        # Check if supplier has any orders
        order_q = select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.clinic_id == clinic_id,
            PurchaseOrder.is_deleted == False,
        )
        order_count = (await self.session.execute(order_q)).scalar_one()
        if order_count > 0:
            raise ValidationError(
                f"Cannot delete supplier with {order_count} existing orders. "
                "Cancel or complete orders first."
            )

        supplier.is_deleted = True
        await self.session.flush()

    async def _get_supplier(self, clinic_id: uuid.UUID, supplier_id: uuid.UUID) -> Supplier:
        q = select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.clinic_id == clinic_id,
            Supplier.is_deleted == False,
        )
        supplier = (await self.session.execute(q)).scalar_one_or_none()
        if not supplier:
            raise NotFoundError("Supplier")
        return supplier
