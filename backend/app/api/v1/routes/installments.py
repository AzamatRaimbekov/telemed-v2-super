from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date, timedelta
from sqlalchemy import select, and_
from app.api.deps import DBSession
from app.models.installment import InstallmentPlan, InstallmentPayment
import uuid
import math

router = APIRouter(tags=["Installments"])


class CreatePlanRequest(BaseModel):
    patient_id: str
    total_amount: float
    installments_count: int
    description: str
    clinic_id: str | None = None


class RecordPaymentRequest(BaseModel):
    amount: float | None = None


@router.post("/installments/")
async def create_plan(session: DBSession, body: CreatePlanRequest):
    """Create an installment plan."""
    monthly = math.ceil(body.total_amount / body.installments_count * 100) / 100
    plan = InstallmentPlan(
        patient_id=uuid.UUID(body.patient_id),
        total_amount=body.total_amount,
        installments_count=body.installments_count,
        monthly_payment=monthly,
        start_date=date.today(),
        description=body.description,
        clinic_id=uuid.UUID(body.clinic_id) if body.clinic_id else uuid.uuid4(),
    )
    session.add(plan)
    await session.flush()

    # Create payment schedule
    for i in range(body.installments_count):
        payment_date = date.today() + timedelta(days=30 * (i + 1))
        payment = InstallmentPayment(
            plan_id=plan.id,
            amount=monthly,
            payment_date=payment_date,
            payment_number=i + 1,
            clinic_id=plan.clinic_id,
        )
        session.add(payment)

    await session.commit()
    await session.refresh(plan)

    return {
        "id": str(plan.id),
        "total_amount": plan.total_amount,
        "monthly_payment": plan.monthly_payment,
        "installments_count": plan.installments_count,
        "start_date": plan.start_date.isoformat(),
        "description": plan.description,
    }


@router.get("/installments/patient/{patient_id}")
async def patient_plans(session: DBSession, patient_id: str):
    """Get patient's installment plans."""
    result = await session.execute(
        select(InstallmentPlan).where(
            InstallmentPlan.patient_id == uuid.UUID(patient_id)
        )
    )
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "total_amount": p.total_amount,
            "paid_amount": p.paid_amount,
            "monthly_payment": p.monthly_payment,
            "installments_count": p.installments_count,
            "start_date": p.start_date.isoformat(),
            "description": p.description,
            "is_active": p.is_active,
            "is_completed": p.is_completed,
        } for p in plans
    ]


@router.post("/installments/{plan_id}/pay")
async def record_payment(session: DBSession, plan_id: str, body: RecordPaymentRequest = None):
    """Record a payment for an installment plan."""
    pid = uuid.UUID(plan_id)
    result = await session.execute(
        select(InstallmentPlan).where(InstallmentPlan.id == pid)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "План не найден")

    # Find next unpaid payment
    payments_result = await session.execute(
        select(InstallmentPayment).where(and_(
            InstallmentPayment.plan_id == pid,
            InstallmentPayment.is_paid == False,
        )).order_by(InstallmentPayment.payment_number).limit(1)
    )
    payment = payments_result.scalar_one_or_none()
    if not payment:
        raise HTTPException(400, "Все платежи уже внесены")

    amount = body.amount if body and body.amount else payment.amount
    payment.is_paid = True
    plan.paid_amount += amount

    if plan.paid_amount >= plan.total_amount:
        plan.is_completed = True
        plan.is_active = False

    await session.commit()

    return {
        "status": "paid",
        "payment_number": payment.payment_number,
        "amount": amount,
        "remaining": plan.total_amount - plan.paid_amount,
        "is_completed": plan.is_completed,
    }


@router.get("/installments/{plan_id}")
async def plan_detail(session: DBSession, plan_id: str):
    """Get plan detail with payment schedule."""
    pid = uuid.UUID(plan_id)
    result = await session.execute(
        select(InstallmentPlan).where(InstallmentPlan.id == pid)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "План не найден")

    payments_result = await session.execute(
        select(InstallmentPayment).where(InstallmentPayment.plan_id == pid).order_by(InstallmentPayment.payment_number)
    )
    payments = payments_result.scalars().all()

    return {
        "id": str(plan.id),
        "total_amount": plan.total_amount,
        "paid_amount": plan.paid_amount,
        "monthly_payment": plan.monthly_payment,
        "installments_count": plan.installments_count,
        "start_date": plan.start_date.isoformat(),
        "description": plan.description,
        "is_active": plan.is_active,
        "is_completed": plan.is_completed,
        "schedule": [
            {
                "number": p.payment_number,
                "amount": p.amount,
                "date": p.payment_date.isoformat(),
                "is_paid": p.is_paid,
            } for p in payments
        ],
    }


@router.get("/portal/installments/my")
async def my_installments(session: DBSession, patient_id: str = None):
    """Patient portal: my installment plans with schedules."""
    if not patient_id:
        return []

    result = await session.execute(
        select(InstallmentPlan).where(
            InstallmentPlan.patient_id == uuid.UUID(patient_id)
        )
    )
    plans = result.scalars().all()
    out = []
    for p in plans:
        payments_result = await session.execute(
            select(InstallmentPayment).where(InstallmentPayment.plan_id == p.id).order_by(InstallmentPayment.payment_number)
        )
        payments = payments_result.scalars().all()
        out.append({
            "id": str(p.id),
            "total_amount": p.total_amount,
            "paid_amount": p.paid_amount,
            "monthly_payment": p.monthly_payment,
            "installments_count": p.installments_count,
            "start_date": p.start_date.isoformat(),
            "description": p.description,
            "is_active": p.is_active,
            "is_completed": p.is_completed,
            "schedule": [
                {
                    "number": pay.payment_number,
                    "amount": pay.amount,
                    "date": pay.payment_date.isoformat(),
                    "is_paid": pay.is_paid,
                } for pay in payments
            ],
        })
    return out
