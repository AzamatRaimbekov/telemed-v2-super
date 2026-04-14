from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.redis import get_redis
from app.core.security import decode_token
from app.core.exceptions import AuthenticationError, NotFoundError
from app.models.patient import Patient
from app.schemas.portal import (
    PortalLoginRequest, PortalTokenResponse, PatientProfileUpdate,
    AppointmentCreate, ExerciseSessionCreate, MessageCreate,
)
from app.schemas.auth import RefreshRequest
from app.services.portal import PortalService
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from typing import Annotated

router = APIRouter(prefix="/portal", tags=["Patient Portal"])
security = HTTPBearer()

DBSession = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]


async def get_portal_patient(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> Patient:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise AuthenticationError("Invalid token")
    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")
    jti = payload.get("jti")
    if await redis.get(f"blacklist:{jti}"):
        raise AuthenticationError("Token revoked")
    patient_id = payload.get("sub")
    query = select(Patient).where(Patient.id == uuid.UUID(patient_id), Patient.is_deleted == False)
    result = await session.execute(query)
    patient = result.scalar_one_or_none()
    if not patient:
        raise AuthenticationError("Patient not found")
    return patient


PortalPatient = Annotated[Patient, Depends(get_portal_patient)]


# AUTH (3)
@router.post("/auth/login", response_model=PortalTokenResponse)
async def portal_login(data: PortalLoginRequest, session: DBSession, redis: RedisClient):
    service = PortalService(session, redis)
    return await service.login(data.phone, data.password)


@router.post("/auth/refresh", response_model=PortalTokenResponse)
async def portal_refresh(data: RefreshRequest, session: DBSession, redis: RedisClient):
    service = PortalService(session, redis)
    return await service.refresh_token(data.refresh_token)


@router.post("/auth/logout")
async def portal_logout(patient: PortalPatient, redis: RedisClient):
    return {"message": "Logged out"}


# PROFILE (2)
@router.get("/profile")
async def get_profile(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    p = await service.get_profile(patient.id)
    return {
        "id": p.id, "first_name": p.first_name, "last_name": p.last_name,
        "middle_name": p.middle_name, "date_of_birth": p.date_of_birth,
        "gender": p.gender.value if p.gender else None, "phone": p.phone, "address": p.address,
        "blood_type": p.blood_type.value if p.blood_type else None, "allergies": p.allergies,
        "chronic_conditions": p.chronic_conditions, "photo_url": p.photo_url,
        "status": p.status.value if p.status else None, "insurance_provider": p.insurance_provider,
        "insurance_number": p.insurance_number, "created_at": p.created_at,
    }


@router.patch("/profile")
async def update_profile(data: PatientProfileUpdate, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    p = await service.update_profile(patient.id, data.phone, data.email, data.address, data.emergency_contact_name, data.emergency_contact_phone)
    return {"status": "updated"}


# MEDICAL CARD (4)
@router.get("/medical-card")
async def get_medical_card(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    card = await service.get_medical_card(patient.id)
    if not card:
        return {"error": "No medical card found"}
    return {"id": card.id, "card_number": card.card_number, "opened_at": card.opened_at, "notes": card.notes, "allergies": patient.allergies, "chronic_conditions": patient.chronic_conditions}


@router.get("/medical-card/vitals")
async def get_vitals(patient: PortalPatient, session: DBSession, days: int = Query(30, ge=7, le=365)):
    service = PortalService(session)
    vitals = await service.get_vitals(patient.id, days)
    return [{"id": v.id, "recorded_at": v.recorded_at, "systolic_bp": v.systolic_bp, "diastolic_bp": v.diastolic_bp, "pulse": v.pulse, "temperature": float(v.temperature) if v.temperature else None, "weight": float(v.weight) if v.weight else None, "spo2": v.spo2, "respiratory_rate": v.respiratory_rate, "blood_glucose": float(v.blood_glucose) if v.blood_glucose else None, "notes": v.notes} for v in vitals]


@router.get("/medical-card/diagnoses")
async def get_diagnoses(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_diagnoses(patient.id)


@router.get("/medical-card/documents")
async def get_documents(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_documents(patient.id, patient.clinic_id)


# LAB RESULTS (4)
@router.get("/results")
async def get_results(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_results(patient.id, patient.clinic_id)


@router.get("/results/{result_id}")
async def get_result_detail(result_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_result_detail(result_id, patient.id)


@router.get("/results/{result_id}/pdf")
async def get_result_pdf(result_id: uuid.UUID, patient: PortalPatient):
    return {"message": "PDF generation will be available in next release"}


@router.get("/results/{test_id}/trend")
async def get_result_trend(test_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_result_trend(test_id, patient.id)


# TREATMENT (2)
@router.get("/treatment")
async def get_treatment(patient: PortalPatient, session: DBSession):
    from app.models.treatment import TreatmentPlan
    query = select(TreatmentPlan).where(TreatmentPlan.patient_id == patient.id, TreatmentPlan.is_deleted == False).order_by(TreatmentPlan.created_at.desc())
    result = await session.execute(query)
    plans = result.scalars().all()
    return [{"id": p.id, "title": p.title, "status": p.status.value, "start_date": p.start_date, "end_date": p.end_date} for p in plans]


@router.get("/treatment/today")
async def get_today_treatment(patient: PortalPatient, session: DBSession):
    from app.models.treatment import TreatmentPlan, TreatmentPlanItem, TreatmentPlanStatus
    from datetime import date
    today = date.today()
    # Get all items from ACTIVE plans where: start_date <= today OR start_date is NULL
    # and plan is within date range
    query = (
        select(TreatmentPlanItem)
        .join(TreatmentPlan)
        .where(
            TreatmentPlan.patient_id == patient.id,
            TreatmentPlan.status == TreatmentPlanStatus.ACTIVE,
            TreatmentPlan.is_deleted == False,
            TreatmentPlanItem.is_deleted == False,
            # Include items with no start_date (they apply from plan creation)
            # or items where start_date <= today
            (TreatmentPlanItem.start_date <= today) | (TreatmentPlanItem.start_date == None),
        )
        .order_by(TreatmentPlanItem.sort_order)
    )
    result = await session.execute(query)
    items = result.scalars().all()
    out = []
    for i in items:
        cfg = i.configuration or {}
        out.append({
            "id": str(i.id),
            "title": i.title or "",
            "type": i.item_type.value,
            "status": i.status.value,
            "frequency": i.frequency,
            "scheduled_at": str(i.scheduled_at) if i.scheduled_at else None,
            "scheduled_time": str(i.scheduled_at).split("T")[1][:5] if i.scheduled_at else None,
            "description": i.description,
            # Medication-specific
            "drug_name": cfg.get("drug_name") or i.title,
            "dosage": cfg.get("dosage"),
            "route": cfg.get("route"),
            "prescription_id": str(i.id),
            # Exercise-specific
            "exercise_id": cfg.get("exercise_id"),
            "exercise_name": cfg.get("exercise_name") or i.title,
            "sets": cfg.get("sets"),
            "reps": cfg.get("reps"),
            # General
            "configuration": cfg,
        })
    return out


# BILLING (5)
@router.get("/billing/summary")
async def get_billing_summary(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_billing_summary(patient.id, patient.clinic_id)


@router.get("/billing/invoices")
async def get_invoices(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    invoices = await service.get_invoices(patient.id, patient.clinic_id)
    return [{"id": i.id, "invoice_number": i.invoice_number, "status": i.status.value if hasattr(i.status, 'value') else str(i.status), "total": float(i.total), "issued_at": i.issued_at, "due_date": i.due_date} for i in invoices]


@router.get("/billing/invoices/{invoice_id}")
async def get_invoice_detail(invoice_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_invoice_detail(invoice_id, patient.id)


@router.get("/billing/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: uuid.UUID, patient: PortalPatient):
    return {"message": "PDF generation available in next release"}


@router.get("/billing/payments")
async def get_payments(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    payments = await service.get_payments(patient.id, patient.clinic_id)
    return [{"id": p.id, "amount": float(p.amount), "payment_method": p.payment_method.value if hasattr(p.payment_method, 'value') else str(p.payment_method), "paid_at": p.paid_at} for p in payments]


# APPOINTMENTS (4)
@router.get("/appointments/slots")
async def get_slots(doctor_id: uuid.UUID, date: str, patient: PortalPatient, session: DBSession):
    from app.models.staff import StaffSchedule
    from datetime import datetime as dt
    target_date = dt.strptime(date, "%Y-%m-%d").date()
    dow = target_date.weekday()
    query = select(StaffSchedule).where(StaffSchedule.user_id == doctor_id, StaffSchedule.day_of_week == dow, StaffSchedule.is_available == True)
    result = await session.execute(query)
    schedules = result.scalars().all()
    slots = []
    for s in schedules:
        hour = s.start_time.hour
        while hour < s.end_time.hour:
            start = dt.combine(target_date, s.start_time.replace(hour=hour))
            end = dt.combine(target_date, s.start_time.replace(hour=hour + 1))
            slots.append({"start": start, "end": end, "available": True})
            hour += 1
    return slots


@router.get("/appointments")
async def get_appointments(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    appts = await service.get_appointments(patient.id, patient.clinic_id)
    return [{"id": a.id, "appointment_type": a.appointment_type.value if hasattr(a.appointment_type, 'value') else str(a.appointment_type), "status": a.status.value if hasattr(a.status, 'value') else str(a.status), "scheduled_start": a.scheduled_start, "scheduled_end": a.scheduled_end, "reason": a.reason} for a in appts]


@router.post("/appointments", status_code=201)
async def create_appointment(data: AppointmentCreate, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    appt = await service.create_appointment(patient.id, patient.clinic_id, data.doctor_id, data.appointment_type, data.scheduled_start, data.scheduled_end, data.reason)
    return {"id": appt.id, "status": "created"}


@router.delete("/appointments/{appointment_id}", status_code=204)
async def cancel_appointment(appointment_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    await service.cancel_appointment(appointment_id, patient.id)


# EXERCISES (5)
@router.get("/exercises/sessions")
async def get_exercise_sessions(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    sessions = await service.get_exercise_sessions(patient.id, patient.clinic_id)
    return [{"id": s.id, "exercise_id": s.exercise_id, "started_at": s.started_at, "reps_completed": s.reps_completed, "sets_completed": s.sets_completed, "accuracy_score": float(s.accuracy_score), "duration_seconds": s.duration_seconds} for s in sessions]


@router.get("/exercises/progress")
async def get_exercise_progress(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_exercise_progress(patient.id, patient.clinic_id)


@router.post("/exercises/sessions", status_code=201)
async def create_exercise_session(data: ExerciseSessionCreate, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    s = await service.create_exercise_session(patient.id, patient.clinic_id, data.model_dump())
    return {"id": s.id, "status": "recorded"}


@router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    e = await service.get_exercise(exercise_id)
    return {"id": e.id, "name": e.name, "description": e.description, "category": e.category.value if hasattr(e.category, 'value') else str(e.category), "difficulty": e.difficulty.value if hasattr(e.difficulty, 'value') else str(e.difficulty), "instructions": e.instructions, "default_sets": e.default_sets, "default_reps": e.default_reps, "target_joints": e.target_joints, "angle_thresholds": e.angle_thresholds}


@router.get("/exercises")
async def get_exercises(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    exercises = await service.get_exercises(patient.clinic_id)
    return [{"id": e.id, "name": e.name, "description": e.description, "category": e.category.value if hasattr(e.category, 'value') else str(e.category), "difficulty": e.difficulty.value if hasattr(e.difficulty, 'value') else str(e.difficulty), "instructions": e.instructions, "default_sets": e.default_sets, "default_reps": e.default_reps} for e in exercises]


# TELEMEDICINE (3)
@router.get("/telemedicine")
async def get_telemedicine(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    sessions = await service.get_telemedicine_sessions(patient.id, patient.clinic_id)
    return [{"id": s.id, "room_id": s.room_id, "status": s.status.value if hasattr(s.status, 'value') else str(s.status), "started_at": s.started_at} for s in sessions]


@router.get("/telemedicine/{session_id}/join")
async def join_telemedicine(session_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    from app.models.telemedicine import TelemedicineSession as TeleSess
    query = select(TeleSess).where(TeleSess.id == session_id, TeleSess.patient_id == patient.id)
    result = await session.execute(query)
    tele = result.scalar_one_or_none()
    if not tele:
        raise NotFoundError("Session")
    return {"room_url": f"https://medcore.daily.co/{tele.room_id}", "token": None}


@router.post("/telemedicine/{session_id}/end")
async def end_telemedicine(session_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    from app.models.telemedicine import TelemedicineSession as TeleSess
    query = select(TeleSess).where(TeleSess.id == session_id, TeleSess.patient_id == patient.id)
    result = await session.execute(query)
    tele = result.scalar_one_or_none()
    if not tele:
        raise NotFoundError("Session")
    tele.status = "COMPLETED"
    tele.ended_at = datetime.now(timezone.utc)
    await session.flush()
    return {"status": "ended"}


# MESSAGES (4)
@router.get("/messages")
async def get_messages(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    user_id = patient.user_id or patient.id
    msgs = await service.get_conversations(user_id, patient.clinic_id)
    return [{"id": m.id, "sender_id": m.sender_id, "recipient_id": m.recipient_id, "content": m.content, "is_read": m.is_read, "created_at": m.created_at} for m in msgs]


@router.post("/messages", status_code=201)
async def send_message(data: MessageCreate, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    user_id = patient.user_id or patient.id
    msg = await service.send_message(user_id, data.recipient_id, data.content, patient.clinic_id, data.attachment_url)
    return {"id": msg.id, "status": "sent"}


@router.get("/messages/{user_id}")
async def get_messages_with_user(user_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    patient_user_id = patient.user_id or patient.id
    msgs = await service.get_messages_with_user(patient_user_id, user_id, patient.clinic_id)
    return [{"id": m.id, "sender_id": m.sender_id, "content": m.content, "is_read": m.is_read, "read_at": m.read_at, "created_at": m.created_at, "attachment_url": m.attachment_url} for m in msgs]


@router.patch("/messages/{message_id}/read")
async def mark_read(message_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    user_id = patient.user_id or patient.id
    await service.mark_message_read(message_id, user_id)
    return {"status": "read"}


# NOTIFICATIONS (2)
@router.get("/notifications")
async def get_notifications(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    user_id = patient.user_id or patient.id
    notifs = await service.get_notifications(user_id)
    return [{"id": n.id, "type": n.type.value if hasattr(n.type, 'value') else str(n.type), "title": n.title, "message": n.message, "severity": n.severity.value if hasattr(n.severity, 'value') else str(n.severity), "is_read": n.is_read, "created_at": n.created_at} for n in notifs]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    user_id = patient.user_id or patient.id
    await service.mark_notification_read(notification_id, user_id)
    return {"status": "read"}


# SCHEDULE (2)
@router.get("/schedule")
async def get_schedule(
    patient: PortalPatient,
    session: DBSession,
    date: str | None = None,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
):
    service = PortalService(session)
    return await service.get_schedule(patient.id, patient.clinic_id, single_date=date, from_date=from_date, to_date=to_date)


@router.get("/schedule/upcoming")
async def get_upcoming_events(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_upcoming_events(patient.id, patient.clinic_id, limit=5)


# PRESCRIPTION CONFIRM (1)
@router.post("/prescriptions/{item_id}/confirm")
async def confirm_prescription(item_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.confirm_prescription(item_id, patient.id)


# DASHBOARD (1)
@router.get("/dashboard")
async def get_dashboard(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_dashboard(patient.id, patient.clinic_id, patient)


# BILLING CATEGORIES (1)
@router.get("/billing/categories")
async def get_billing_categories(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_billing_categories(patient.id, patient.clinic_id)


# VISIT DETAIL (1)
@router.get("/visits/{visit_id}")
async def get_visit_detail(visit_id: uuid.UUID, patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_visit_detail(visit_id, patient.id, patient.clinic_id)


# DOCUMENTS (1) — replaces placeholder
@router.get("/documents")
async def get_documents_list(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_documents(patient.id, patient.clinic_id)


# TREATMENT PLANS FULL (1)
@router.get("/treatment-plans")
async def get_treatment_plans_full(patient: PortalPatient, session: DBSession):
    service = PortalService(session)
    return await service.get_treatment_plans_full(patient.id, patient.clinic_id)


# RECOVERY DYNAMICS (4) — portal-facing, read-only
@router.get("/recovery/vitals")
async def portal_recovery_vitals(
    patient: PortalPatient,
    session: DBSession,
    days: int = Query(90, ge=7, le=365),
):
    """Patient's own vital signs for recovery dashboard."""
    service = PortalService(session)
    vitals = await service.get_vitals(patient.id, days)
    return [
        {
            "recorded_at": v.recorded_at,
            "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp,
            "pulse": v.pulse,
            "temperature": float(v.temperature) if v.temperature else None,
            "weight": float(v.weight) if v.weight else None,
            "spo2": v.spo2,
            "respiratory_rate": v.respiratory_rate,
            "blood_glucose": float(v.blood_glucose) if v.blood_glucose else None,
        }
        for v in vitals
    ]


@router.get("/recovery/assessments")
async def portal_recovery_assessments(patient: PortalPatient, session: DBSession):
    """Patient's own stroke/rehab assessments for recovery dashboard."""
    from app.models.stroke import StrokeAssessment
    query = (
        select(StrokeAssessment)
        .where(
            StrokeAssessment.patient_id == patient.id,
            StrokeAssessment.is_deleted == False,
        )
        .order_by(StrokeAssessment.assessed_at)
    )
    result = await session.execute(query)
    assessments = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "assessment_type": a.assessment_type.value,
            "score": float(a.score) if a.score is not None else None,
            "max_score": float(a.max_score) if a.max_score is not None else None,
            "assessed_at": a.assessed_at,
            "interpretation": a.interpretation,
        }
        for a in assessments
    ]


@router.get("/recovery/exercise-sessions")
async def portal_recovery_exercise_sessions(patient: PortalPatient, session: DBSession):
    """Patient's own exercise sessions for recovery dashboard."""
    service = PortalService(session)
    sessions = await service.get_exercise_sessions(patient.id, patient.clinic_id)
    return [
        {
            "id": str(s.id),
            "started_at": s.started_at,
            "completed_at": getattr(s, "completed_at", None),
            "accuracy_score": float(s.accuracy_score) if s.accuracy_score is not None else None,
            "duration_seconds": s.duration_seconds,
            "reps_completed": s.reps_completed,
            "sets_completed": s.sets_completed,
        }
        for s in sessions
    ]


@router.get("/recovery/lab-results")
async def portal_recovery_lab_results(patient: PortalPatient, session: DBSession):
    """Patient's own lab results for recovery dashboard."""
    service = PortalService(session)
    return await service.get_results(patient.id, patient.clinic_id)
