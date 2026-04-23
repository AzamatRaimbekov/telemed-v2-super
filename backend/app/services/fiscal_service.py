import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.fiscal import FiscalReceipt, FiscalStatus


class FiscalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_receipt(
        self,
        payment_id: uuid.UUID,
        amount: float,
        clinic_id: uuid.UUID,
        description: str = "Медицинские услуги",
    ) -> FiscalReceipt:
        """Register a fiscal receipt with KKM/eSalyk."""
        receipt = FiscalReceipt(
            payment_id=payment_id,
            amount=amount,
            clinic_id=clinic_id,
            status=FiscalStatus.PENDING,
        )
        self.db.add(receipt)
        await self.db.commit()
        await self.db.refresh(receipt)

        try:
            kkm_url = getattr(settings, "KKM_API_URL", "")
            kkm_key = getattr(settings, "KKM_API_KEY", "")

            if not kkm_url or not kkm_key:
                # No KKM configured — mark as success with placeholder
                receipt.status = FiscalStatus.SUCCESS
                receipt.receipt_number = f"RC-{str(receipt.id)[:8].upper()}"
                receipt.fiscal_sign = "DEMO-MODE"
                receipt.sent_at = datetime.now(timezone.utc)
            else:
                # Real KKM API call (eSalyk compatible)
                payload = {
                    "type": "sale",
                    "items": [
                        {
                            "name": description,
                            "quantity": 1,
                            "price": amount,
                            "amount": amount,
                        }
                    ],
                    "total": amount,
                    "payment_type": "cash",
                }
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{kkm_url}/receipt",
                        json=payload,
                        headers={"Authorization": f"Bearer {kkm_key}"},
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    receipt.status = FiscalStatus.SUCCESS
                    receipt.receipt_number = data.get("receipt_number", "")
                    receipt.fiscal_sign = data.get("fiscal_sign", "")
                    receipt.fiscal_document_number = data.get("fd_number", "")
                    receipt.fn_serial = data.get("fn_serial", "")
                    receipt.receipt_url = data.get("receipt_url", "")
                    receipt.raw_response = data
                    receipt.sent_at = datetime.now(timezone.utc)

        except Exception as e:
            receipt.status = FiscalStatus.FAILED
            receipt.error_message = str(e)[:500]

        await self.db.commit()
        await self.db.refresh(receipt)
        return receipt

    async def get_receipt(self, receipt_id: uuid.UUID) -> FiscalReceipt | None:
        result = await self.db.execute(
            select(FiscalReceipt).where(FiscalReceipt.id == receipt_id)
        )
        return result.scalar_one_or_none()

    async def get_by_payment(self, payment_id: uuid.UUID) -> FiscalReceipt | None:
        result = await self.db.execute(
            select(FiscalReceipt).where(FiscalReceipt.payment_id == payment_id)
        )
        return result.scalar_one_or_none()

    async def list_receipts(
        self, clinic_id: uuid.UUID, status: str | None = None, limit: int = 50
    ):
        query = select(FiscalReceipt).where(FiscalReceipt.clinic_id == clinic_id)
        if status:
            query = query.where(FiscalReceipt.status == status)
        query = query.order_by(FiscalReceipt.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def retry_failed(self, receipt_id: uuid.UUID) -> FiscalReceipt | None:
        receipt = await self.get_receipt(receipt_id)
        if receipt and receipt.status == FiscalStatus.FAILED:
            return await self.register_receipt(
                receipt.payment_id, receipt.amount, receipt.clinic_id
            )
        return receipt
