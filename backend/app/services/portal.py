from __future__ import annotations
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

    async def update_profile(self, patient_id: uuid.UUID, phone: str | None = None, email: str | None = None, address: str | None = None, emergency_contact_name: str | None = None, emergency_contact_phone: str | None = None) -> Patient:
        patient = await self.get_profile(patient_id)
        if phone is not None:
            patient.phone = phone
        if address is not None:
            patient.address = address
        if emergency_contact_name is not None:
            patient.emergency_contact_name = emergency_contact_name
        if emergency_contact_phone is not None:
            patient.emergency_contact_phone = emergency_contact_phone
        await self.session.flush()
        await self.session.refresh(patient)
        return patient

    async def update_notification_preferences(self, patient_id: uuid.UUID, preferences: dict) -> Patient:
        """Save notification preferences (JSON) to the patient record."""
        patient = await self.get_profile(patient_id)
        patient.notification_preferences = preferences
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

    # --- Schedule ---
    async def get_schedule(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
        single_date: str | None = None,
        from_date: str | None = None, to_date: str | None = None,
    ) -> list[dict]:
        from datetime import date as date_type
        from app.models.treatment import TreatmentPlan, TreatmentPlanItem, TreatmentItemType, TreatmentItemStatus

        now = datetime.now(timezone.utc)

        # Determine date range
        def parse_date(s: str) -> date_type:
            """Parse date from ISO string, handling both '2026-04-10' and '2026-04-10T00:00:00Z' formats."""
            return date_type.fromisoformat(s.split("T")[0])

        if single_date:
            d = parse_date(single_date)
            range_start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
            range_end = range_start + timedelta(days=1)
        elif from_date and to_date:
            d1 = parse_date(from_date)
            d2 = parse_date(to_date)
            range_start = datetime(d1.year, d1.month, d1.day, tzinfo=timezone.utc)
            range_end = datetime(d2.year, d2.month, d2.day, 23, 59, 59, tzinfo=timezone.utc)
        else:
            # Default: today
            today = now.date()
            range_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
            range_end = range_start + timedelta(days=1)

        events: list[dict] = []

        # Treatment plan items (medications, procedures, exercises, etc.)
        items_q = (
            select(TreatmentPlanItem, TreatmentPlan)
            .join(TreatmentPlan, TreatmentPlanItem.treatment_plan_id == TreatmentPlan.id)
            .where(
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.clinic_id == clinic_id,
                TreatmentPlan.is_deleted == False,
                TreatmentPlanItem.is_deleted == False,
                TreatmentPlanItem.scheduled_at >= range_start,
                TreatmentPlanItem.scheduled_at < range_end,
            )
            .order_by(TreatmentPlanItem.scheduled_at)
        )
        items_result = await self.session.execute(items_q)
        type_map = {
            TreatmentItemType.MEDICATION: "medication",
            TreatmentItemType.PROCEDURE: "procedure",
            TreatmentItemType.LAB_TEST: "lab",
            TreatmentItemType.EXERCISE: "exercise",
            TreatmentItemType.THERAPY: "procedure",
            TreatmentItemType.DIET: "medication",
            TreatmentItemType.MONITORING: "procedure",
        }
        status_map = {
            TreatmentItemStatus.PENDING: "scheduled",
            TreatmentItemStatus.IN_PROGRESS: "scheduled",
            TreatmentItemStatus.COMPLETED: "completed",
            TreatmentItemStatus.CANCELLED: "cancelled",
        }
        for item, plan in items_result.all():
            doctor_name = None
            if plan.doctor:
                doctor_name = f"{plan.doctor.last_name} {plan.doctor.first_name}"
            events.append({
                "id": item.id,
                "type": type_map.get(item.item_type, "procedure"),
                "title": item.title,
                "scheduled_at": item.scheduled_at,
                "duration_minutes": 30,
                "location": None,
                "doctor_name": doctor_name,
                "status": status_map.get(item.status, "scheduled"),
                "notes": item.description,
            })

        # Appointments
        appts_q = (
            select(Appointment)
            .where(
                Appointment.patient_id == patient_id,
                Appointment.clinic_id == clinic_id,
                Appointment.is_deleted == False,
                Appointment.scheduled_start >= range_start,
                Appointment.scheduled_start < range_end,
            )
            .order_by(Appointment.scheduled_start)
        )
        appts_result = await self.session.execute(appts_q)
        appt_type_map = {"CONSULTATION": "consultation", "FOLLOW_UP": "consultation", "PROCEDURE": "procedure", "TELEMEDICINE": "telemedicine"}
        appt_status_map = {"SCHEDULED": "scheduled", "CONFIRMED": "scheduled", "CHECKED_IN": "scheduled", "IN_PROGRESS": "scheduled", "COMPLETED": "completed", "CANCELLED": "cancelled", "NO_SHOW": "skipped"}
        for a in appts_result.scalars().all():
            doctor_name = None
            if a.doctor:
                doctor_name = f"{a.doctor.last_name} {a.doctor.first_name}"
            duration = 60
            if a.scheduled_start and a.scheduled_end:
                duration = int((a.scheduled_end - a.scheduled_start).total_seconds() / 60)
            events.append({
                "id": a.id,
                "type": appt_type_map.get(a.appointment_type.value if hasattr(a.appointment_type, 'value') else str(a.appointment_type), "consultation"),
                "title": a.reason or f"Прием: {a.appointment_type.value if hasattr(a.appointment_type, 'value') else str(a.appointment_type)}",
                "scheduled_at": a.scheduled_start,
                "duration_minutes": duration,
                "location": None,
                "doctor_name": doctor_name,
                "status": appt_status_map.get(a.status.value if hasattr(a.status, 'value') else str(a.status), "scheduled"),
                "notes": a.notes,
            })

        # Lab orders (scheduled)
        lab_q = (
            select(LabOrder, LabTestCatalog)
            .join(LabTestCatalog, LabOrder.test_id == LabTestCatalog.id)
            .where(
                LabOrder.patient_id == patient_id,
                LabOrder.clinic_id == clinic_id,
                LabOrder.is_deleted == False,
                LabOrder.expected_at >= range_start,
                LabOrder.expected_at < range_end,
            )
            .order_by(LabOrder.expected_at)
        )
        lab_result = await self.session.execute(lab_q)
        lab_status_map = {"ORDERED": "scheduled", "SAMPLE_COLLECTED": "scheduled", "IN_PROGRESS": "scheduled", "COMPLETED": "completed", "CANCELLED": "cancelled"}
        for lo, test in lab_result.all():
            events.append({
                "id": lo.id,
                "type": "lab",
                "title": f"Анализ: {test.name}",
                "scheduled_at": lo.expected_at,
                "duration_minutes": 15,
                "location": None,
                "doctor_name": None,
                "status": lab_status_map.get(lo.status.value if hasattr(lo.status, 'value') else str(lo.status), "scheduled"),
                "notes": lo.notes,
            })

        # Sort all events by scheduled_at
        events.sort(key=lambda e: e["scheduled_at"] or now)
        return events

    async def get_upcoming_events(self, patient_id: uuid.UUID, clinic_id: uuid.UUID, limit: int = 5) -> list[dict]:
        """Returns next N upcoming events from the schedule."""
        now = datetime.now(timezone.utc)
        # Get events for the next 30 days and pick the first `limit`
        future = now + timedelta(days=30)
        all_events = await self.get_schedule(
            patient_id, clinic_id,
            from_date=now.strftime("%Y-%m-%d"),
            to_date=future.strftime("%Y-%m-%d"),
        )
        # Filter only future, non-completed events
        upcoming = [e for e in all_events if e["scheduled_at"] and e["scheduled_at"] >= now and e["status"] == "scheduled"]
        return upcoming[:limit]

    # --- Prescription confirm ---
    async def confirm_prescription(self, item_id: uuid.UUID, patient_id: uuid.UUID) -> dict:
        from app.models.treatment import TreatmentPlan, TreatmentPlanItem, TreatmentItemStatus

        query = (
            select(TreatmentPlanItem)
            .join(TreatmentPlan, TreatmentPlanItem.treatment_plan_id == TreatmentPlan.id)
            .where(
                TreatmentPlanItem.id == item_id,
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlanItem.is_deleted == False,
            )
        )
        result = await self.session.execute(query)
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError("Prescription item")

        now = datetime.now(timezone.utc)
        item.status = TreatmentItemStatus.COMPLETED
        item.updated_at = now
        await self.session.flush()

        return {"id": item.id, "status": "confirmed", "confirmed_at": now}

    # --- Dashboard ---
    async def get_dashboard(self, patient_id: uuid.UUID, clinic_id: uuid.UUID, patient: "Patient") -> dict:
        from app.models.treatment import TreatmentPlan, TreatmentPlanItem, TreatmentPlanStatus, TreatmentItemStatus
        from app.models.vital_signs import VitalSign

        now = datetime.now(timezone.utc)

        # Basic patient info
        patient_info = {
            "id": patient.id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "middle_name": patient.middle_name,
            "photo_url": patient.photo_url,
            "status": patient.status.value if patient.status else None,
        }

        # Next appointment
        next_appt_q = (
            select(Appointment)
            .where(
                Appointment.patient_id == patient_id,
                Appointment.clinic_id == clinic_id,
                Appointment.is_deleted == False,
                Appointment.scheduled_start >= now,
                Appointment.status.in_(["SCHEDULED", "CONFIRMED"]),
            )
            .order_by(Appointment.scheduled_start.asc())
            .limit(1)
        )
        next_appt_r = await self.session.execute(next_appt_q)
        next_appt = next_appt_r.scalar_one_or_none()
        next_appointment = None
        if next_appt:
            doctor_name = None
            if next_appt.doctor:
                doctor_name = f"{next_appt.doctor.last_name} {next_appt.doctor.first_name}"
            next_appointment = {
                "id": next_appt.id,
                "appointment_type": next_appt.appointment_type.value if hasattr(next_appt.appointment_type, 'value') else str(next_appt.appointment_type),
                "scheduled_start": next_appt.scheduled_start,
                "scheduled_end": next_appt.scheduled_end,
                "doctor_name": doctor_name,
                "reason": next_appt.reason,
            }

        # Today events count
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        today_end = today_start + timedelta(days=1)
        today_events = await self.get_schedule(patient_id, clinic_id, single_date=now.strftime("%Y-%m-%d"))
        today_events_count = len(today_events)

        # Unread notifications
        user_id = patient.user_id or patient.id
        unread_q = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.is_deleted == False,
        )
        unread_r = await self.session.execute(unread_q)
        unread_notifications = unread_r.scalar_one()

        # Treatment progress (across active plans)
        plans_q = (
            select(TreatmentPlan)
            .where(
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.clinic_id == clinic_id,
                TreatmentPlan.is_deleted == False,
                TreatmentPlan.status == TreatmentPlanStatus.ACTIVE,
            )
        )
        plans_r = await self.session.execute(plans_q)
        plans = plans_r.scalars().all()
        total_items = 0
        completed_items = 0
        for p in plans:
            if p.items:
                for item in p.items:
                    if not item.is_deleted:
                        total_items += 1
                        if item.status == TreatmentItemStatus.COMPLETED:
                            completed_items += 1
        progress_percent = round((completed_items / total_items * 100) if total_items > 0 else 0, 1)

        # Latest vitals
        vitals_q = (
            select(VitalSign)
            .where(VitalSign.patient_id == patient_id, VitalSign.is_deleted == False)
            .order_by(VitalSign.recorded_at.desc())
            .limit(1)
        )
        vitals_r = await self.session.execute(vitals_q)
        latest_vital = vitals_r.scalar_one_or_none()
        latest_vitals = None
        if latest_vital:
            latest_vitals = {
                "recorded_at": latest_vital.recorded_at,
                "systolic_bp": latest_vital.systolic_bp,
                "diastolic_bp": latest_vital.diastolic_bp,
                "pulse": latest_vital.pulse,
                "temperature": float(latest_vital.temperature) if latest_vital.temperature else None,
                "weight": float(latest_vital.weight) if latest_vital.weight else None,
                "spo2": latest_vital.spo2,
            }

        # Exercise stats
        exercise_progress = await self.get_exercise_progress(patient_id, clinic_id)

        return {
            "patient": patient_info,
            "next_appointment": next_appointment,
            "today_events_count": today_events_count,
            "unread_notifications": unread_notifications,
            "treatment_progress": {
                "total_items": total_items,
                "completed_items": completed_items,
                "progress_percent": progress_percent,
            },
            "latest_vitals": latest_vitals,
            "exercise_stats": {
                "this_week_sessions": exercise_progress["this_week_sessions"],
                "avg_accuracy": exercise_progress["avg_accuracy"],
                "total_reps": exercise_progress["total_reps"],
            },
        }

    # --- Billing categories ---
    async def get_billing_categories(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[dict]:
        query = (
            select(
                InvoiceItem.item_type,
                func.sum(InvoiceItem.total_price).label("total"),
            )
            .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
            .where(
                Invoice.patient_id == patient_id,
                Invoice.clinic_id == clinic_id,
                Invoice.is_deleted == False,
                InvoiceItem.is_deleted == False,
            )
            .group_by(InvoiceItem.item_type)
        )
        result = await self.session.execute(query)
        rows = result.all()

        label_map = {
            "CONSULTATION": "Консультации",
            "PROCEDURE": "Процедуры",
            "LAB_TEST": "Лабораторные анализы",
            "MEDICATION": "Лекарства",
            "ROOM": "Палата",
            "OTHER": "Прочее",
        }
        return [
            {
                "category": (row.item_type.value if hasattr(row.item_type, 'value') else str(row.item_type)).lower(),
                "label": label_map.get(row.item_type.value if hasattr(row.item_type, 'value') else str(row.item_type), "Прочее"),
                "total": float(row.total or 0),
            }
            for row in rows
        ]

    # --- Visit detail ---
    async def get_visit_detail(self, visit_id: uuid.UUID, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        from app.models.treatment import TreatmentPlan, TreatmentPlanItem

        query = select(Visit).where(
            Visit.id == visit_id,
            Visit.patient_id == patient_id,
            Visit.is_deleted == False,
        )
        result = await self.session.execute(query)
        visit = result.scalar_one_or_none()
        if not visit:
            raise NotFoundError("Visit")

        doctor_name = None
        if visit.doctor:
            doctor_name = f"{visit.doctor.last_name} {visit.doctor.first_name}"

        # Linked prescriptions (treatment plan items from plans linked to this visit)
        prescriptions: list[dict] = []
        plans_q = (
            select(TreatmentPlan)
            .where(
                TreatmentPlan.visit_id == visit_id,
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.is_deleted == False,
            )
        )
        plans_r = await self.session.execute(plans_q)
        for plan in plans_r.scalars().all():
            if plan.items:
                for item in plan.items:
                    if not item.is_deleted:
                        prescriptions.append({
                            "id": item.id,
                            "item_type": item.item_type.value,
                            "title": item.title,
                            "description": item.description,
                            "status": item.status.value,
                            "frequency": item.frequency,
                        })

        return {
            "id": visit.id,
            "visit_type": visit.visit_type.value if hasattr(visit.visit_type, 'value') else str(visit.visit_type),
            "status": visit.status.value if hasattr(visit.status, 'value') else str(visit.status),
            "chief_complaint": visit.chief_complaint,
            "examination_notes": visit.examination_notes,
            "diagnosis_codes": visit.diagnosis_codes,
            "diagnosis_text": visit.diagnosis_text,
            "doctor_name": doctor_name,
            "started_at": visit.started_at,
            "ended_at": visit.ended_at,
            "prescriptions": prescriptions,
        }

    # --- Documents ---
    async def get_documents(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[dict]:
        from app.models.medical_history import MedicalHistoryEntry

        query = (
            select(MedicalHistoryEntry)
            .where(
                MedicalHistoryEntry.patient_id == patient_id,
                MedicalHistoryEntry.clinic_id == clinic_id,
                MedicalHistoryEntry.is_deleted == False,
                MedicalHistoryEntry.source_document_url != None,
            )
            .order_by(MedicalHistoryEntry.recorded_at.desc())
        )
        result = await self.session.execute(query)
        entries = result.scalars().all()

        docs = []
        for e in entries:
            author_name = None
            if e.author:
                author_name = f"{e.author.last_name} {e.author.first_name}"
            docs.append({
                "id": e.id,
                "title": e.title,
                "entry_type": e.entry_type.value if hasattr(e.entry_type, 'value') else str(e.entry_type),
                "recorded_at": e.recorded_at,
                "source_document_url": e.source_document_url,
                "author_name": author_name,
            })
        return docs

    # --- Treatment plans with items ---
    async def get_treatment_plans_full(self, patient_id: uuid.UUID, clinic_id: uuid.UUID) -> list[dict]:
        from app.models.treatment import TreatmentPlan, TreatmentPlanItem, TreatmentItemStatus

        query = (
            select(TreatmentPlan)
            .where(
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.clinic_id == clinic_id,
                TreatmentPlan.is_deleted == False,
            )
            .order_by(TreatmentPlan.created_at.desc())
        )
        result = await self.session.execute(query)
        plans = result.scalars().all()

        output = []
        for plan in plans:
            doctor_name = None
            if plan.doctor:
                doctor_name = f"{plan.doctor.last_name} {plan.doctor.first_name}"

            items = []
            total = 0
            completed = 0
            if plan.items:
                for item in plan.items:
                    if item.is_deleted:
                        continue
                    total += 1
                    if item.status == TreatmentItemStatus.COMPLETED:
                        completed += 1
                    items.append({
                        "id": item.id,
                        "item_type": item.item_type.value,
                        "title": item.title,
                        "description": item.description,
                        "status": item.status.value,
                        "frequency": item.frequency,
                        "scheduled_at": item.scheduled_at,
                        "configuration": item.configuration,
                    })

            progress = round((completed / total * 100) if total > 0 else 0, 1)
            output.append({
                "id": plan.id,
                "title": plan.title,
                "description": plan.description,
                "doctor_name": doctor_name,
                "status": plan.status.value,
                "start_date": plan.start_date,
                "end_date": plan.end_date,
                "items": items,
                "total_items": total,
                "completed_items": completed,
                "progress_percent": progress,
            })
        return output
