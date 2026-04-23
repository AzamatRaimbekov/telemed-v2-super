from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, InvoiceItem, InvoiceItemType, InvoiceStatus


class AutoBillingService:
    """Automatically generate invoices after a patient visit."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_invoice_number(self, clinic_id: uuid.UUID) -> str:
        from sqlalchemy import func

        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"INV-{today}-"
        result = await self.db.execute(
            select(func.count(Invoice.id)).where(
                Invoice.clinic_id == clinic_id,
                Invoice.invoice_number.like(f"{prefix}%"),
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{count + 1:04d}"

    async def generate_invoice_for_visit(
        self,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        clinic_id: uuid.UUID,
        visit_id: uuid.UUID | None = None,
        services: list[dict] | None = None,
    ) -> Invoice:
        """Auto-generate invoice after a visit.

        services: [{"name": "Консультация терапевта", "price": 500.0, "quantity": 1}]
        """
        if not services:
            services = [{"name": "Консультация врача", "price": 500.0, "quantity": 1}]

        subtotal = sum(s["price"] * s.get("quantity", 1) for s in services)
        invoice_number = await self._generate_invoice_number(clinic_id)

        invoice = Invoice(
            patient_id=patient_id,
            visit_id=visit_id,
            clinic_id=clinic_id,
            invoice_number=invoice_number,
            subtotal=subtotal,
            total=subtotal,
            status=InvoiceStatus.DRAFT,
        )
        self.db.add(invoice)
        await self.db.flush()

        for s in services:
            item = InvoiceItem(
                invoice_id=invoice.id,
                item_type=InvoiceItemType.CONSULTATION,
                description=s["name"],
                quantity=s.get("quantity", 1),
                unit_price=s["price"],
                total_price=s["price"] * s.get("quantity", 1),
                clinic_id=clinic_id,
            )
            self.db.add(item)

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def get_service_templates(self, clinic_id: uuid.UUID) -> list[dict]:
        """Return default service price templates for a clinic."""
        return [
            {"name": "Консультация терапевта", "price": 500.0, "category": "CONSULTATION"},
            {"name": "Консультация невролога", "price": 700.0, "category": "CONSULTATION"},
            {"name": "Консультация кардиолога", "price": 800.0, "category": "CONSULTATION"},
            {"name": "ЭКГ", "price": 300.0, "category": "PROCEDURE"},
            {"name": "УЗИ", "price": 600.0, "category": "PROCEDURE"},
            {"name": "ОАК (общий анализ крови)", "price": 200.0, "category": "LAB_TEST"},
            {"name": "Биохимия крови", "price": 350.0, "category": "LAB_TEST"},
            {"name": "МРТ головного мозга", "price": 3500.0, "category": "PROCEDURE"},
            {"name": "КТ головного мозга", "price": 2500.0, "category": "PROCEDURE"},
            {"name": "Палата (сутки)", "price": 1500.0, "category": "ROOM"},
        ]
