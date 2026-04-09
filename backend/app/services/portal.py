import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, NotFoundError, ForbiddenError
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.patient import Patient
from app.models.medical import MedicalCard, Visit
from app.models.laboratory import LabOrder, LabResult, LabTestCatalog
from app.models.billing import Invoice, InvoiceItem, Payment
from app.models.appointment import Appointment
from app.models.exercise import Exercise, ExerciseSession
from app.models.telemedicine import TelemedicineSession, Message
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import TokenResponse


class PortalService:
    def __init__(self, session: AsyncSession, redis: Redis | None = None) -> None:
        self.session = session
        self.redis = redis

    # --- Auth ---
    async def login(self, phone: str, password: str) -> TokenResponse:
        query = select(Patient).where(Patient.phone == phone, Patient.is_deleted == False)
        result = await self.session.execute(query)
        patient = result.scalar_one_or_none()
        if not patient or not patient.portal_password_hash:
            raise AuthenticationError("Invalid credentials")
        if not verify_password(password, patient.portal_password_hash):
            raise AuthenticationError("Invalid credentials")
        patient.last_portal_login = datetime.now(timezone.utc)
        await self.session.flush()
        access = create_access_token(str(patient.id), "PATIENT", str(patient.clinic_id))
        refresh = create_refresh_token(str(patient.id), "PATIENT", str(patient.clinic_id))
        return TokenResponse(access_token=access, refresh_token=refresh)

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise AuthenticationError("Invalid refresh token")
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")
        patient_id = payload.get("sub")
        query = select(Patient).where(Patient.id == uuid.UUID(patient_id), Patient.is_deleted == False)
        result = await self.session.execute(query)
        patient = result.scalar_one_or_none()
        if not patient:
            raise AuthenticationError("Patient not found")
        access = create_access_token(str(patient.id), "PATIENT", str(patient.clinic_id))
        refresh = create_refresh_token(str(patient.id), "PATIENT", str(patient.clinic_id))
        return TokenResponse(access_token=access, refresh_token=refresh)

    # --- Profile ---
    async def get_profile(self, patient_id: uuid.UUID) -> Patient:
        query = select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
        result = await self.session.execute(query)
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundError("Patient")
        return patient

    async def update_profile(self, patient_id: uuid.UUID, phone: str | None = None, email: str | None = None, address: str | None = None) -> Patient:
        patient = await self.get_profile(patient_id)
        if phone is not None:
            patient.phone = phone
        if email is not None:
            # store in a field or user if linked
            pass
        if address is not None:
            patient.address = address
        await self.session.flush()
        await self.session.refresh(patient)
        return patient

    # --- Medical Card ---
    async def get_medical_card(self, patient_id: uuid.UUID) -> MedicalCard | None:
        query = select(MedicalCard).where(MedicalCard.patient_id == patient_id, MedicalCard.is_deleted == False)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_vitals(self, patient_id: uuid.UUID, days: int = 30) -> list:
        from app.models.vital_signs import VitalSign
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = (
            select(VitalSign)
            .where(VitalSign.patient_id == patient_id, VitalSign.recorded_at >= since, VitalSign.is_deleted == False)
            .order_by(VitalSign.recorded_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_diagnoses(self, patient_id: uuid.UUID) -> list[dict]:
        query = (
            select(Visit)
            .where(Visit.patient_id == patient_id, Visit.diagnosis_codes != None, Visit.is_deleted == False)
            .order_by(Visit.started_at.desc())
        )
        result = await self.session.execute(query)
        visits = result.scalars().all()
        diagnoses = []
        for v in visits:
            if v.diagnosis_codes:
                for code in v.diagnosis_codes:
                    diagnoses.append({
                        "code": code,
                        "text": v.diagnosis_text,
                        "date": v.started_at,
                        "doctor_name": "",
                        "status": "active",
                    })
        return diagnoses

    # --- Lab Results ---
    async def get_results(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(LabResult, LabOrder, LabTestCatalog)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .join(LabTestCatalog, LabOrder.test_id == LabTestCatalog.id)
            .where(
                LabOrder.patient_id == patient_id,
                LabOrder.clinic_id == clinic_id,
                LabResult.visible_to_patient == True,
                LabResult.is_deleted == False,
            )
            .order_by(LabResult.resulted_at.desc())
        )
        result = await self.session.execute(query)
        rows = result.all()
        return [
            {
                "id": r.id,
                "test_name": t.name,
                "test_code": t.code,
                "category": t.category,
                "value": r.value,
                "numeric_value": float(r.numeric_value) if r.numeric_value else None,
                "unit": r.unit,
                "reference_range": r.reference_range,
                "is_abnormal": r.is_abnormal,
                "notes": r.notes,
                "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
                "resulted_at": r.resulted_at,
                "approved_at": r.approved_at,
            }
            for r, o, t in rows
        ]

    async def get_result_detail(self, result_id: uuid.UUID, patient_id: uuid.UUID) -> dict:
        query = (
            select(LabResult, LabOrder, LabTestCatalog)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .join(LabTestCatalog, LabOrder.test_id == LabTestCatalog.id)
            .where(
                LabResult.id == result_id,
                LabOrder.patient_id == patient_id,
                LabResult.visible_to_patient == True,
            )
        )
        result = await self.session.execute(query)
        row = result.first()
        if not row:
            raise NotFoundError("Lab result")
        r, o, t = row
        return {
            "id": r.id,
            "test_name": t.name,
            "test_code": t.code,
            "category": t.category,
            "value": r.value,
            "numeric_value": float(r.numeric_value) if r.numeric_value else None,
            "unit": r.unit,
            "reference_range": r.reference_range,
            "is_abnormal": r.is_abnormal,
            "notes": r.notes,
            "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
            "resulted_at": r.resulted_at,
            "approved_at": r.approved_at,
            "doctor_comment": r.notes,
        }

    async def get_result_trend(self, test_id: uuid.UUID, patient_id: uuid.UUID) -> list[dict]:
        query = (
            select(LabResult, LabOrder)
            .join(LabOrder, LabResult.lab_order_id == LabOrder.id)
            .where(
                LabOrder.test_id == test_id,
                LabOrder.patient_id == patient_id,
                LabResult.visible_to_patient == True,
                LabResult.numeric_value != None,
            )
            .order_by(LabResult.resulted_at.asc())
        )
        result = await self.session.execute(query)
        return [
            {"date": r.resulted_at, "value": float(r.numeric_value), "is_abnormal": r.is_abnormal}
            for r, o in result.all()
        ]

    # --- Billing ---
    async def get_billing_summary(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        query = select(Invoice).where(
            Invoice.patient_id == patient_id, Invoice.clinic_id == clinic_id, Invoice.is_deleted == False
        )
        result = await self.session.execute(query)
        invoices = result.scalars().all()
        total = sum(float(i.total) for i in invoices)
        insurance = sum(float(i.insurance_claim_amount) for i in invoices)

        pay_query = (
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Invoice, Payment.invoice_id == Invoice.id)
            .where(Invoice.patient_id == patient_id, Invoice.clinic_id == clinic_id)
        )
        pay_result = await self.session.execute(pay_query)
        paid = float(pay_result.scalar_one())
        return {"total_amount": total, "total_paid": paid, "insurance_covered": insurance, "patient_balance": total - paid - insurance}

    async def get_invoices(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(Invoice)
            .where(Invoice.patient_id == patient_id, Invoice.clinic_id == clinic_id, Invoice.is_deleted == False)
            .order_by(Invoice.issued_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_invoice_detail(self, invoice_id: uuid.UUID, patient_id: uuid.UUID) -> dict:
        query = select(Invoice).where(Invoice.id == invoice_id, Invoice.patient_id == patient_id)
        result = await self.session.execute(query)
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundError("Invoice")
        items_q = select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
        items_r = await self.session.execute(items_q)
        items = [{"description": i.description, "quantity": i.quantity, "unit_price": float(i.unit_price), "total_price": float(i.total_price), "item_type": i.item_type.value if hasattr(i.item_type, 'value') else str(i.item_type)} for i in items_r.scalars().all()]
        pays_q = select(Payment).where(Payment.invoice_id == invoice_id)
        pays_r = await self.session.execute(pays_q)
        payments = [{"amount": float(p.amount), "method": p.payment_method.value if hasattr(p.payment_method, 'value') else str(p.payment_method), "paid_at": p.paid_at} for p in pays_r.scalars().all()]
        return {
            "id": invoice.id, "invoice_number": invoice.invoice_number, "status": invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
            "subtotal": float(invoice.subtotal), "discount": float(invoice.discount), "tax": float(invoice.tax),
            "total": float(invoice.total), "insurance_claim_amount": float(invoice.insurance_claim_amount),
            "issued_at": invoice.issued_at, "due_date": invoice.due_date, "items": items, "payments": payments,
        }

    async def get_payments(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(Payment)
            .join(Invoice, Payment.invoice_id == Invoice.id)
            .where(Invoice.patient_id == patient_id, Invoice.clinic_id == clinic_id)
            .order_by(Payment.paid_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # --- Appointments ---
    async def get_appointments(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(Appointment)
            .where(Appointment.patient_id == patient_id, Appointment.clinic_id == clinic_id, Appointment.is_deleted == False)
            .order_by(Appointment.scheduled_start.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_appointment(self, patient_id: uuid.UUID, clinic_id: uuid.UUID, doctor_id: uuid.UUID, appointment_type: str, scheduled_start: datetime, scheduled_end: datetime, reason: str | None = None) -> Appointment:
        appt = Appointment(
            id=uuid.uuid4(), patient_id=patient_id, doctor_id=doctor_id,
            appointment_type=appointment_type, scheduled_start=scheduled_start,
            scheduled_end=scheduled_end, reason=reason, clinic_id=clinic_id,
        )
        self.session.add(appt)
        await self.session.flush()
        await self.session.refresh(appt)
        return appt

    async def cancel_appointment(self, appointment_id: uuid.UUID, patient_id: uuid.UUID) -> None:
        query = select(Appointment).where(Appointment.id == appointment_id, Appointment.patient_id == patient_id)
        result = await self.session.execute(query)
        appt = result.scalar_one_or_none()
        if not appt:
            raise NotFoundError("Appointment")
        appt.status = "CANCELLED"
        await self.session.flush()

    # --- Exercises ---
    async def get_exercises(self, clinic_id: uuid.UUID) -> list:
        query = select(Exercise).where(Exercise.clinic_id == clinic_id, Exercise.is_active == True, Exercise.is_deleted == False)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_exercise(self, exercise_id: uuid.UUID) -> Exercise:
        query = select(Exercise).where(Exercise.id == exercise_id, Exercise.is_deleted == False)
        result = await self.session.execute(query)
        ex = result.scalar_one_or_none()
        if not ex:
            raise NotFoundError("Exercise")
        return ex

    async def create_exercise_session(self, patient_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> ExerciseSession:
        session_obj = ExerciseSession(
            id=uuid.uuid4(),
            patient_id=patient_id,
            exercise_id=data["exercise_id"],
            treatment_plan_item_id=data.get("treatment_plan_item_id"),
            reps_completed=data["reps_completed"],
            sets_completed=data["sets_completed"],
            accuracy_score=data["accuracy_score"],
            duration_seconds=data["duration_seconds"],
            feedback=data.get("feedback", []),
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            clinic_id=clinic_id,
        )
        self.session.add(session_obj)
        await self.session.flush()
        await self.session.refresh(session_obj)
        return session_obj

    async def get_exercise_sessions(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(ExerciseSession)
            .where(ExerciseSession.patient_id == patient_id, ExerciseSession.clinic_id == clinic_id, ExerciseSession.is_deleted == False)
            .order_by(ExerciseSession.started_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_exercise_progress(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        total_q = select(func.count()).select_from(ExerciseSession).where(ExerciseSession.patient_id == patient_id, ExerciseSession.clinic_id == clinic_id)
        total_r = await self.session.execute(total_q)
        total = total_r.scalar_one()
        week_q = select(func.count()).select_from(ExerciseSession).where(ExerciseSession.patient_id == patient_id, ExerciseSession.started_at >= week_ago)
        week_r = await self.session.execute(week_q)
        week = week_r.scalar_one()
        avg_q = select(func.avg(ExerciseSession.accuracy_score)).where(ExerciseSession.patient_id == patient_id)
        avg_r = await self.session.execute(avg_q)
        avg = float(avg_r.scalar_one() or 0)
        reps_q = select(func.sum(ExerciseSession.reps_completed)).where(ExerciseSession.patient_id == patient_id)
        reps_r = await self.session.execute(reps_q)
        reps = int(reps_r.scalar_one() or 0)
        return {"total_sessions": total, "this_week_sessions": week, "avg_accuracy": round(avg, 2), "total_reps": reps, "streak_days": 0}

    # --- Telemedicine ---
    async def get_telemedicine_sessions(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(TelemedicineSession)
            .where(TelemedicineSession.patient_id == patient_id, TelemedicineSession.clinic_id == clinic_id, TelemedicineSession.is_deleted == False)
            .order_by(TelemedicineSession.created_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # --- Messages ---
    async def get_conversations(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(Message)
            .where(
                Message.clinic_id == clinic_id,
                Message.is_deleted == False,
                ((Message.sender_id == patient_id) | (Message.recipient_id == patient_id)),
            )
            .order_by(Message.created_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_messages_with_user(self, patient_id: uuid.UUID, other_user_id: uuid.UUID, clinic_id: uuid.UUID) -> list:
        query = (
            select(Message)
            .where(
                Message.clinic_id == clinic_id,
                Message.is_deleted == False,
                (
                    ((Message.sender_id == patient_id) & (Message.recipient_id == other_user_id)) |
                    ((Message.sender_id == other_user_id) & (Message.recipient_id == patient_id))
                ),
            )
            .order_by(Message.created_at.asc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def send_message(self, sender_id: uuid.UUID, recipient_id: uuid.UUID, content: str, clinic_id: uuid.UUID, attachment_url: str | None = None) -> Message:
        msg = Message(
            id=uuid.uuid4(), sender_id=sender_id, recipient_id=recipient_id,
            content=content, attachment_url=attachment_url, clinic_id=clinic_id,
        )
        self.session.add(msg)
        await self.session.flush()
        await self.session.refresh(msg)
        return msg

    async def mark_message_read(self, message_id: uuid.UUID, patient_id: uuid.UUID) -> None:
        query = select(Message).where(Message.id == message_id, Message.recipient_id == patient_id)
        result = await self.session.execute(query)
        msg = result.scalar_one_or_none()
        if msg:
            msg.is_read = True
            msg.read_at = datetime.now(timezone.utc)
            await self.session.flush()

    # --- Notifications ---
    async def get_notifications(self, user_id: uuid.UUID) -> list:
        query = (
            select(Notification)
            .where(Notification.user_id == user_id, Notification.is_deleted == False)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def mark_notification_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        query = select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
        result = await self.session.execute(query)
        notif = result.scalar_one_or_none()
        if notif:
            notif.is_read = True
            notif.read_at = datetime.now(timezone.utc)
            await self.session.flush()
