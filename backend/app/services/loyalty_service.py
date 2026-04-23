from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loyalty import LoyaltyAccount, PointsTransaction, PointsTransactionType


class LoyaltyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------- helpers ----------

    @staticmethod
    def calculate_tier(total_earned: int) -> str:
        if total_earned >= 5000:
            return "platinum"
        if total_earned >= 2000:
            return "gold"
        if total_earned >= 500:
            return "silver"
        return "bronze"

    # ---------- account ----------

    async def get_or_create_account(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> LoyaltyAccount:
        result = await self.db.execute(
            select(LoyaltyAccount).where(
                LoyaltyAccount.patient_id == patient_id,
                LoyaltyAccount.is_deleted == False,
            )
        )
        account = result.scalar_one_or_none()
        if account:
            return account

        account = LoyaltyAccount(
            patient_id=patient_id,
            clinic_id=clinic_id,
            balance=0,
            total_earned=0,
            total_spent=0,
            tier="bronze",
        )
        self.db.add(account)
        await self.db.flush()
        return account

    # ---------- earn ----------

    async def earn_points(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        amount: int,
        description: str,
        reference_id: uuid.UUID | None = None,
    ) -> PointsTransaction:
        account = await self.get_or_create_account(patient_id, clinic_id)
        account.balance += amount
        account.total_earned += amount
        account.tier = self.calculate_tier(account.total_earned)

        txn = PointsTransaction(
            account_id=account.id,
            clinic_id=clinic_id,
            amount=amount,
            transaction_type=PointsTransactionType.EARNED,
            description=description,
            reference_id=reference_id,
        )
        self.db.add(txn)
        await self.db.flush()
        return txn

    # ---------- spend ----------

    async def spend_points(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        amount: int,
        description: str,
    ) -> PointsTransaction:
        account = await self.get_or_create_account(patient_id, clinic_id)
        if account.balance < amount:
            raise ValueError(f"Недостаточно баллов: {account.balance} < {amount}")
        account.balance -= amount
        account.total_spent += amount

        txn = PointsTransaction(
            account_id=account.id,
            clinic_id=clinic_id,
            amount=-amount,
            transaction_type=PointsTransactionType.SPENT,
            description=description,
        )
        self.db.add(txn)
        await self.db.flush()
        return txn

    # ---------- read ----------

    async def get_balance(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        account = await self.get_or_create_account(patient_id, clinic_id)
        return {
            "balance": account.balance,
            "total_earned": account.total_earned,
            "total_spent": account.total_spent,
            "tier": account.tier,
        }

    async def get_history(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID, limit: int = 50
    ) -> list[dict]:
        account = await self.get_or_create_account(patient_id, clinic_id)
        result = await self.db.execute(
            select(PointsTransaction)
            .where(
                PointsTransaction.account_id == account.id,
                PointsTransaction.is_deleted == False,
            )
            .order_by(PointsTransaction.created_at.desc())
            .limit(limit)
        )
        txns = result.scalars().all()
        return [
            {
                "id": str(t.id),
                "amount": t.amount,
                "transaction_type": t.transaction_type,
                "description": t.description,
                "reference_id": str(t.reference_id) if t.reference_id else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ]
