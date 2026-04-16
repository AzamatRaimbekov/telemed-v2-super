from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.billing import (
    Invoice,
    InvoiceItem,
    InvoiceItemType,
    InvoiceStatus,
    InsuranceClaimStatus,
    Payment,
    PaymentMethod,
)
from app.models.patient import Patient
from app.schemas.billing import (
    BillingStatsOut,
    InvoiceCreate,
    InvoiceOut,
    InvoiceUpdate,
    PaymentCreate,
    PaymentOut,
)


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Invoice number generation
    # ------------------------------------------------------------------

    async def _generate_invoice_number(self, clinic_id: uuid.UUID) -> str:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"INV-{today}-"
        result = await self.session.execute(
            select(func.count(Invoice.id)).where(
                Invoice.clinic_id == clinic_id,
                Invoice.invoice_number.like(f"{prefix}%"),
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{count + 1:04d}"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _patient_full_name(self, patient: Patient) -> str:
        parts = [patient.last_name, patient.first_name]
        if patient.middle_name:
            parts.append(patient.middle_name)
        return " ".join(parts)

    def _invoice_to_out(self, invoice: Invoice) -> InvoiceOut:
        patient_name = None
        if invoice.patient:
            patient_name = self._patient_full_name(invoice.patient)

        payments_list = []
        for p in (invoice.payments or []):
            payments_list.append({
                "id": str(p.id),
                "amount": float(p.amount),
                "payment_method": p.payment_method.value if isinstance(p.payment_method, PaymentMethod) else str(p.payment_method),
                "reference_number": p.reference_number,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "received_by_name": (
                    p.received_by.full_name
                    if hasattr(p, "received_by") and p.received_by and hasattr(p.received_by, "full_name")
                    else None
                ),
            })

        return InvoiceOut(
            id=invoice.id,
            patient_id=invoice.patient_id,
            invoice_number=invoice.invoice_number,
            status=invoice.status.value if isinstance(invoice.status, InvoiceStatus) else str(invoice.status),
            subtotal=float(invoice.subtotal or 0),
            discount=float(invoice.discount or 0),
            tax=float(invoice.tax or 0),
            total=float(invoice.total or 0),
            insurance_claim_amount=float(invoice.insurance_claim_amount) if invoice.insurance_claim_amount is not None else None,
            insurance_claim_status=invoice.insurance_claim_status.value if isinstance(invoice.insurance_claim_status, InsuranceClaimStatus) else str(invoice.insurance_claim_status),
            due_date=invoice.due_date,
            notes=invoice.notes,
            issued_at=invoice.issued_at,
            created_at=invoice.created_at,
            items=[
                {
                    "id": item.id,
                    "item_type": item.item_type.value if isinstance(item.item_type, InvoiceItemType) else str(item.item_type),
                    "description": item.description,
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "total_price": float(item.total_price),
                }
                for item in (invoice.items or [])
            ],
            payments=payments_list,
            patient_name=patient_name,
        )

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_invoice(
        self,
        clinic_id: uuid.UUID,
        data: InvoiceCreate,
    ) -> InvoiceOut:
        invoice_number = await self._generate_invoice_number(clinic_id)

        subtotal = sum(item.quantity * item.unit_price for item in data.items)
        total = subtotal - data.discount + data.tax

        invoice = Invoice(
            clinic_id=clinic_id,
            patient_id=data.patient_id,
            visit_id=data.visit_id,
            treatment_plan_id=data.treatment_plan_id,
            invoice_number=invoice_number,
            status=InvoiceStatus.DRAFT,
            subtotal=subtotal,
            discount=data.discount,
            tax=data.tax,
            total=total,
            insurance_claim_amount=data.insurance_claim_amount,
            due_date=data.due_date,
            notes=data.notes,
        )
        self.session.add(invoice)
        await self.session.flush()

        for item_data in data.items:
            item = InvoiceItem(
                clinic_id=clinic_id,
                invoice_id=invoice.id,
                item_type=InvoiceItemType(item_data.item_type),
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                total_price=item_data.quantity * item_data.unit_price,
                reference_id=item_data.reference_id,
            )
            self.session.add(item)

        await self.session.flush()

        # Re-fetch with relationships
        return await self.get_invoice(invoice.id, clinic_id)

    async def get_invoices(
        self,
        clinic_id: uuid.UUID,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[InvoiceOut], int]:
        query = select(Invoice).where(
            Invoice.clinic_id == clinic_id,
            Invoice.is_deleted == False,
        )

        if patient_id:
            query = query.where(Invoice.patient_id == patient_id)
        if status:
            query = query.where(Invoice.status == InvoiceStatus(status))

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        # Fetch
        query = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        invoices = list(result.scalars().all())

        return [self._invoice_to_out(inv) for inv in invoices], total

    async def get_invoice(
        self,
        invoice_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> InvoiceOut:
        result = await self.session.execute(
            select(Invoice).where(
                Invoice.id == invoice_id,
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice")
        return self._invoice_to_out(invoice)

    async def update_invoice(
        self,
        invoice_id: uuid.UUID,
        clinic_id: uuid.UUID,
        data: InvoiceUpdate,
    ) -> InvoiceOut:
        result = await self.session.execute(
            select(Invoice).where(
                Invoice.id == invoice_id,
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice")

        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data and update_data["status"] is not None:
            new_status = InvoiceStatus(update_data["status"])
            update_data["status"] = new_status
            if new_status == InvoiceStatus.ISSUED and invoice.issued_at is None:
                invoice.issued_at = datetime.now(timezone.utc)

        if "insurance_claim_status" in update_data and update_data["insurance_claim_status"] is not None:
            update_data["insurance_claim_status"] = InsuranceClaimStatus(update_data["insurance_claim_status"])

        # Recalculate total if discount or tax changed
        recalc = False
        if "discount" in update_data and update_data["discount"] is not None:
            recalc = True
        if "tax" in update_data and update_data["tax"] is not None:
            recalc = True

        for key, value in update_data.items():
            if value is not None:
                setattr(invoice, key, value)

        if recalc:
            invoice.total = float(invoice.subtotal or 0) - float(invoice.discount or 0) + float(invoice.tax or 0)

        await self.session.flush()
        return await self.get_invoice(invoice_id, clinic_id)

    async def delete_invoice(
        self,
        invoice_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> None:
        result = await self.session.execute(
            select(Invoice).where(
                Invoice.id == invoice_id,
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice")
        invoice.is_deleted = True
        await self.session.flush()

    # ------------------------------------------------------------------
    # Payments
    # ------------------------------------------------------------------

    async def record_payment(
        self,
        clinic_id: uuid.UUID,
        user_id: uuid.UUID,
        data: PaymentCreate,
    ) -> PaymentOut:
        # Validate invoice
        result = await self.session.execute(
            select(Invoice).where(
                Invoice.id == data.invoice_id,
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice")

        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValidationError("Cannot record payment for a cancelled invoice")

        payment = Payment(
            clinic_id=clinic_id,
            invoice_id=data.invoice_id,
            amount=data.amount,
            payment_method=PaymentMethod(data.payment_method),
            reference_number=data.reference_number,
            paid_at=datetime.now(timezone.utc),
            received_by_id=user_id,
        )
        self.session.add(payment)
        await self.session.flush()

        # Update invoice status based on total payments
        total_paid_result = await self.session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.invoice_id == invoice.id,
                Payment.is_deleted == False,
            )
        )
        total_paid = float(total_paid_result.scalar() or 0)
        invoice_total = float(invoice.total or 0)

        if total_paid >= invoice_total:
            invoice.status = InvoiceStatus.PAID
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        await self.session.flush()

        received_by_name = None
        if payment.received_by:
            received_by_name = getattr(payment.received_by, "full_name", None)

        return PaymentOut(
            id=payment.id,
            invoice_id=payment.invoice_id,
            amount=float(payment.amount),
            payment_method=payment.payment_method.value if isinstance(payment.payment_method, PaymentMethod) else str(payment.payment_method),
            reference_number=payment.reference_number,
            paid_at=payment.paid_at,
            received_by_name=received_by_name,
        )

    async def get_payments(
        self,
        clinic_id: uuid.UUID,
        patient_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[PaymentOut], int]:
        query = select(Payment).where(
            Payment.clinic_id == clinic_id,
            Payment.is_deleted == False,
        )

        if patient_id:
            query = query.join(Invoice, Payment.invoice_id == Invoice.id).where(
                Invoice.patient_id == patient_id
            )

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar() or 0

        query = query.order_by(Payment.paid_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        payments = list(result.scalars().all())

        items = []
        for p in payments:
            received_by_name = None
            if p.received_by:
                received_by_name = getattr(p.received_by, "full_name", None)
            items.append(PaymentOut(
                id=p.id,
                invoice_id=p.invoice_id,
                amount=float(p.amount),
                payment_method=p.payment_method.value if isinstance(p.payment_method, PaymentMethod) else str(p.payment_method),
                reference_number=p.reference_number,
                paid_at=p.paid_at,
                received_by_name=received_by_name,
            ))

        return items, total

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    async def get_billing_stats(self, clinic_id: uuid.UUID) -> BillingStatsOut:
        base = select(Invoice).where(
            Invoice.clinic_id == clinic_id,
            Invoice.is_deleted == False,
        )

        # Total invoiced
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(Invoice.total), 0),
                func.count(Invoice.id),
            ).where(
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
            )
        )
        row = result.one()
        total_invoiced = float(row[0])
        invoice_count = row[1]

        # Total paid
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(Invoice.total), 0),
                func.count(Invoice.id),
            ).where(
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
                Invoice.status == InvoiceStatus.PAID,
            )
        )
        row = result.one()
        total_paid = float(row[0])
        paid_count = row[1]

        # Overdue
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(Invoice.total), 0),
                func.count(Invoice.id),
            ).where(
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
                Invoice.status == InvoiceStatus.OVERDUE,
            )
        )
        row = result.one()
        total_overdue = float(row[0])
        overdue_count = row[1]

        total_outstanding = total_invoiced - total_paid

        return BillingStatsOut(
            total_invoiced=total_invoiced,
            total_paid=total_paid,
            total_outstanding=total_outstanding,
            total_overdue=total_overdue,
            invoice_count=invoice_count,
            paid_count=paid_count,
            overdue_count=overdue_count,
        )
