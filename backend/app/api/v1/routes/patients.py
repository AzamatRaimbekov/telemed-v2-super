import uuid
from fastapi import APIRouter, Query
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.patient import (
    PatientCreate, PatientUpdate, PatientOut, PatientListOut,
    MedicalCardOut, VitalSignCreate, VitalSignOut,
    LabResultApproval, TreatmentPlanCreate, TreatmentPlanItemCreate,
)
from app.services.patient import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("")
async def list_patients(
    session: DBSession, current_user: CurrentUser,
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    search: str | None = None, status: str | None = None, doctor_id: uuid.UUID | None = None,
):
    service = PatientService(session)
    patients, total = await service.list_patients(current_user.clinic_id, skip, limit, search, status, doctor_id)
    return {
        "items": [
            {
                "id": p.id, "first_name": p.first_name, "last_name": p.last_name,
                "middle_name": p.middle_name, "date_of_birth": p.date_of_birth,
                "gender": p.gender.value, "phone": p.phone, "status": p.status.value,
                "assigned_doctor_id": p.assigned_doctor_id, "blood_type": p.blood_type.value,
                "created_at": p.created_at,
            }
            for p in patients
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", status_code=201)
async def create_patient(
    data: PatientCreate, session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST),
):
    service = PatientService(session)
    patient = await service.create_patient(data.model_dump(), current_user.clinic_id)
    return {"id": patient.id, "status": "created", "card_number": (await service.get_medical_card(patient.id)).card_number if await service.get_medical_card(patient.id) else None}


@router.get("/{patient_id}")
async def get_patient(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    p = await service.get_patient(patient_id, current_user.clinic_id)
    card = await service.get_medical_card(p.id)
    return {
        "id": p.id, "first_name": p.first_name, "last_name": p.last_name,
        "middle_name": p.middle_name, "date_of_birth": p.date_of_birth,
        "gender": p.gender.value, "passport_number": p.passport_number, "inn": p.inn,
        "address": p.address, "phone": p.phone,
        "emergency_contact_name": p.emergency_contact_name,
        "emergency_contact_phone": p.emergency_contact_phone,
        "blood_type": p.blood_type.value, "allergies": p.allergies,
        "chronic_conditions": p.chronic_conditions,
        "insurance_provider": p.insurance_provider, "insurance_number": p.insurance_number,
        "assigned_doctor_id": p.assigned_doctor_id, "assigned_nurse_id": p.assigned_nurse_id,
        "photo_url": p.photo_url, "registration_source": p.registration_source.value,
        "status": p.status.value, "created_at": p.created_at, "updated_at": p.updated_at,
        "medical_card": {"id": card.id, "card_number": card.card_number, "opened_at": card.opened_at} if card else None,
    }


@router.patch("/{patient_id}")
async def update_patient(
    patient_id: uuid.UUID, data: PatientUpdate, session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST),
):
    service = PatientService(session)
    p = await service.update_patient(patient_id, data.model_dump(exclude_unset=True), current_user.clinic_id)
    return {"id": p.id, "status": "updated"}


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = PatientService(session)
    await service.delete_patient(patient_id, current_user.clinic_id)


# --- Vitals ---
@router.get("/{patient_id}/vitals")
async def get_vitals(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    vitals = await service.get_vitals(patient_id, current_user.clinic_id)
    return [
        {
            "id": v.id, "recorded_at": v.recorded_at, "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp, "pulse": v.pulse,
            "temperature": float(v.temperature) if v.temperature else None,
            "weight": float(v.weight) if v.weight else None, "spo2": v.spo2,
            "respiratory_rate": v.respiratory_rate,
            "blood_glucose": float(v.blood_glucose) if v.blood_glucose else None,
            "notes": v.notes,
        }
        for v in vitals
    ]


@router.post("/{patient_id}/vitals", status_code=201)
async def add_vitals(
    patient_id: uuid.UUID, data: VitalSignCreate, session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE),
):
    service = PatientService(session)
    vital_data = data.model_dump()
    vital_data["patient_id"] = patient_id
    v = await service.add_vital_signs(vital_data, current_user.id, current_user.clinic_id)
    return {"id": v.id, "status": "recorded"}


# --- Lab Results ---
@router.get("/{patient_id}/results")
async def get_lab_results(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    return await service.get_lab_results(patient_id, current_user.clinic_id)


@router.patch("/results/{result_id}/approve")
async def approve_lab_result(
    result_id: uuid.UUID, data: LabResultApproval, session: DBSession, current_user: CurrentUser,
    _doctor=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    service = PatientService(session)
    r = await service.approve_lab_result(result_id, current_user.id, data.visible_to_patient)
    return {"id": r.id, "visible_to_patient": r.visible_to_patient, "approved_at": r.approved_at}


# --- Treatment Plans ---
@router.get("/{patient_id}/treatment-plans")
async def get_treatment_plans(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    plans = await service.get_treatment_plans(patient_id, current_user.clinic_id)
    return [
        {"id": p.id, "title": p.title, "description": p.description, "status": p.status.value, "start_date": p.start_date, "end_date": p.end_date, "created_at": p.created_at}
        for p in plans
    ]


@router.post("/{patient_id}/treatment-plans", status_code=201)
async def create_treatment_plan(
    patient_id: uuid.UUID, data: TreatmentPlanCreate, session: DBSession, current_user: CurrentUser,
    _doctor=require_role(UserRole.DOCTOR),
):
    service = PatientService(session)
    plan_data = data.model_dump()
    plan_data["patient_id"] = patient_id
    plan = await service.create_treatment_plan(plan_data, current_user.id, current_user.clinic_id)
    return {"id": plan.id, "status": "created"}


@router.post("/treatment-plans/items", status_code=201)
async def add_treatment_item(
    data: TreatmentPlanItemCreate, session: DBSession, current_user: CurrentUser,
    _doctor=require_role(UserRole.DOCTOR),
):
    service = PatientService(session)
    item = await service.add_treatment_item(data.model_dump(), current_user.clinic_id)
    return {"id": item.id, "status": "added"}


@router.get("/treatment-plans/{plan_id}/items")
async def get_treatment_items(plan_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    items = await service.get_treatment_items(plan_id)
    return [
        {"id": i.id, "item_type": i.item_type.value, "title": i.title, "description": i.description, "status": i.status.value, "sort_order": i.sort_order, "start_date": i.start_date, "end_date": i.end_date, "frequency": i.frequency, "configuration": i.configuration}
        for i in items
    ]


# --- Exercise Sessions ---
@router.get("/{patient_id}/exercise-sessions")
async def get_exercise_sessions(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    sessions = await service.get_exercise_sessions(patient_id, current_user.clinic_id)
    return [
        {"id": s.id, "exercise_id": s.exercise_id, "started_at": s.started_at, "completed_at": s.completed_at, "reps_completed": s.reps_completed, "sets_completed": s.sets_completed, "accuracy_score": float(s.accuracy_score), "duration_seconds": s.duration_seconds}
        for s in sessions
    ]


# --- Visits ---
@router.get("/{patient_id}/visits")
async def get_visits(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = PatientService(session)
    visits = await service.get_visits(patient_id, current_user.clinic_id)
    return [
        {"id": v.id, "visit_type": v.visit_type.value, "status": v.status.value, "chief_complaint": v.chief_complaint, "diagnosis_codes": v.diagnosis_codes, "diagnosis_text": v.diagnosis_text, "started_at": v.started_at, "ended_at": v.ended_at}
        for v in visits
    ]
