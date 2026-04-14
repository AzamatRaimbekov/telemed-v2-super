from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Query, Request, File, UploadFile, Form
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.patient import (
    PatientCreate, PatientUpdate, PatientOut, PatientListOut,
    MedicalCardOut, VitalSignCreate, VitalSignOut,
    LabResultApproval, TreatmentPlanCreate, TreatmentPlanItemCreate,
    PortalPasswordReset,
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
    data: PatientCreate, request: Request, session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST),
):
    service = PatientService(session)
    patient = await service.create_patient(
        data.model_dump(),
        current_user.clinic_id,
        changed_by_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    card = await service.get_medical_card(patient.id)

    # Get doctor/nurse names if assigned
    doctor_info = None
    nurse_info = None
    if patient.assigned_doctor_id:
        from app.models.user import User
        doc_q = select(User).where(User.id == patient.assigned_doctor_id)
        doc_r = await session.execute(doc_q)
        doc = doc_r.scalar_one_or_none()
        if doc:
            doctor_info = {"id": str(doc.id), "full_name": f"{doc.last_name} {doc.first_name[0]}."}
    if patient.assigned_nurse_id:
        nurse_q = select(User).where(User.id == patient.assigned_nurse_id)
        nurse_r = await session.execute(nurse_q)
        nur = nurse_r.scalar_one_or_none()
        if nur:
            nurse_info = {"id": str(nur.id), "full_name": f"{nur.last_name} {nur.first_name[0]}."}

    return {
        "patient_id": str(patient.id),
        "card_number": card.card_number if card else None,
        "doctor": doctor_info,
        "nurse": nurse_info,
        "redirect_url": f"/patients/{patient.id}",
    }


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
        "has_portal_password": p.portal_password_hash is not None,
        "last_portal_login": p.last_portal_login,
    }


@router.patch("/{patient_id}")
async def update_patient(
    patient_id: uuid.UUID, data: PatientUpdate, request: Request, session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST),
):
    service = PatientService(session)
    p = await service.update_patient(
        patient_id,
        data.model_dump(exclude_unset=True),
        current_user.clinic_id,
        changed_by_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"id": p.id, "status": "updated"}


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: uuid.UUID, request: Request, session: DBSession, current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = PatientService(session)
    await service.delete_patient(
        patient_id,
        current_user.clinic_id,
        changed_by_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/{patient_id}/reset-portal-password")
async def reset_portal_password(
    patient_id: uuid.UUID,
    data: PortalPasswordReset,
    request: Request,
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    service = PatientService(session)
    await service.reset_portal_password(
        patient_id=patient_id,
        new_password=data.new_password,
        clinic_id=current_user.clinic_id,
        changed_by_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"status": "ok", "message": "Portal password updated"}


@router.get("/{patient_id}/audit-logs")
async def get_patient_audit_logs(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    service = PatientService(session)
    # Verify patient exists and belongs to this clinic
    await service.get_patient(patient_id, current_user.clinic_id)
    items, total = await service.get_patient_audit_logs(patient_id, skip, limit, action)
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


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
    result_id: uuid.UUID, data: LabResultApproval, request: Request, session: DBSession, current_user: CurrentUser,
    _doctor=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    service = PatientService(session)
    r = await service.approve_lab_result(
        result_id,
        current_user.id,
        data.visible_to_patient,
        clinic_id=current_user.clinic_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
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


# --- Diagnoses (extracted from visits) ---
@router.get("/{patient_id}/diagnoses")
async def get_diagnoses(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.medical import Visit, VisitStatus
    from sqlalchemy import select, desc
    service = PatientService(session)
    # Verify patient access
    await service.get_patient(patient_id, current_user.clinic_id)

    query = (
        select(Visit)
        .where(
            Visit.patient_id == patient_id,
            Visit.clinic_id == current_user.clinic_id,
            Visit.is_deleted == False,
            Visit.diagnosis_codes != None,
        )
        .order_by(desc(Visit.started_at))
    )
    result = await session.execute(query)
    visits = list(result.scalars().all())

    diagnoses = []
    for v in visits:
        if not v.diagnosis_codes:
            continue
        codes = v.diagnosis_codes if isinstance(v.diagnosis_codes, list) else [v.diagnosis_codes]
        for code in codes:
            doctor_name = ""
            if v.doctor:
                doctor_name = f"{v.doctor.last_name} {v.doctor.first_name}"
            diagnoses.append({
                "id": str(v.id),
                "code": code if isinstance(code, str) else str(code),
                "text": v.diagnosis_text,
                "visit_type": v.visit_type.value if hasattr(v.visit_type, "value") else str(v.visit_type),
                "visit_status": v.status.value if hasattr(v.status, "value") else str(v.status),
                "chief_complaint": v.chief_complaint,
                "doctor_id": str(v.doctor_id),
                "doctor_name": doctor_name,
                "date": v.started_at,
                "status": "active" if v.status.value == "COMPLETED" else "pending",
            })
    return diagnoses


# --- Procedure Orders ---
@router.get("/{patient_id}/procedure-orders")
async def list_procedure_orders(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = None,
):
    from app.models.procedure import ProcedureOrder, ProcedureOrderStatus, Procedure
    query = (
        select(ProcedureOrder)
        .where(
            ProcedureOrder.patient_id == patient_id,
            ProcedureOrder.clinic_id == current_user.clinic_id,
            ProcedureOrder.is_deleted == False,
        )
        .order_by(desc(ProcedureOrder.scheduled_at), desc(ProcedureOrder.created_at))
    )
    if status:
        query = query.where(ProcedureOrder.status == ProcedureOrderStatus(status))
    result = await session.execute(query)
    orders = list(result.scalars().all())
    return [_procedure_order_to_dict(o) for o in orders]


@router.get("/{patient_id}/procedure-orders/{order_id}")
async def get_procedure_order(
    patient_id: uuid.UUID, order_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
):
    from app.models.procedure import ProcedureOrder
    query = select(ProcedureOrder).where(
        ProcedureOrder.id == order_id,
        ProcedureOrder.patient_id == patient_id,
        ProcedureOrder.clinic_id == current_user.clinic_id,
        ProcedureOrder.is_deleted == False,
    )
    result = await session.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("ProcedureOrder", str(order_id))
    return _procedure_order_to_dict(order)


@router.post("/{patient_id}/procedure-orders", status_code=201)
async def create_procedure_order(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
    procedure_id: uuid.UUID = Query(...),
    scheduled_at: str | None = None,
    notes: str | None = None,
):
    from app.models.procedure import ProcedureOrder, ProcedureOrderStatus, Procedure
    # Verify procedure exists
    proc_q = select(Procedure).where(Procedure.id == procedure_id, Procedure.is_deleted == False)
    proc_result = await session.execute(proc_q)
    procedure = proc_result.scalar_one_or_none()
    if not procedure:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Procedure", str(procedure_id))

    order = ProcedureOrder(
        id=uuid.uuid4(),
        patient_id=patient_id,
        procedure_id=procedure_id,
        ordered_by_id=current_user.id,
        clinic_id=current_user.clinic_id,
        status=ProcedureOrderStatus.ORDERED,
        scheduled_at=datetime.fromisoformat(scheduled_at) if scheduled_at else None,
        notes=notes,
    )
    session.add(order)
    await session.flush()
    await session.refresh(order)
    await session.commit()
    return _procedure_order_to_dict(order)


@router.patch("/{patient_id}/procedure-orders/{order_id}")
async def update_procedure_order(
    patient_id: uuid.UUID, order_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
    status: str | None = None,
    notes: str | None = None,
    scheduled_at: str | None = None,
    performed_by_id: uuid.UUID | None = None,
    consent_signed: bool | None = None,
):
    from app.models.procedure import ProcedureOrder, ProcedureOrderStatus
    query = select(ProcedureOrder).where(
        ProcedureOrder.id == order_id,
        ProcedureOrder.patient_id == patient_id,
        ProcedureOrder.clinic_id == current_user.clinic_id,
        ProcedureOrder.is_deleted == False,
    )
    result = await session.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("ProcedureOrder", str(order_id))

    now = datetime.now(timezone.utc)
    if status:
        order.status = ProcedureOrderStatus(status)
        if status == "IN_PROGRESS" and not order.started_at:
            order.started_at = now
        elif status == "COMPLETED" and not order.completed_at:
            order.completed_at = now
    if notes is not None:
        order.notes = notes
    if scheduled_at is not None:
        order.scheduled_at = datetime.fromisoformat(scheduled_at) if scheduled_at else None
    if performed_by_id is not None:
        order.performed_by_id = performed_by_id
    if consent_signed is not None:
        order.consent_signed = consent_signed

    await session.flush()
    await session.refresh(order)
    await session.commit()
    return _procedure_order_to_dict(order)


@router.delete("/{patient_id}/procedure-orders/{order_id}", status_code=204)
async def delete_procedure_order(
    patient_id: uuid.UUID, order_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    from app.models.procedure import ProcedureOrder
    query = select(ProcedureOrder).where(
        ProcedureOrder.id == order_id,
        ProcedureOrder.patient_id == patient_id,
        ProcedureOrder.clinic_id == current_user.clinic_id,
        ProcedureOrder.is_deleted == False,
    )
    result = await session.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("ProcedureOrder", str(order_id))
    order.is_deleted = True
    await session.flush()
    await session.commit()


# --- Prescriptions ---
@router.get("/{patient_id}/prescriptions")
async def list_prescriptions(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = None,
):
    from app.models.medication import Prescription, PrescriptionStatus
    query = (
        select(Prescription)
        .where(
            Prescription.patient_id == patient_id,
            Prescription.clinic_id == current_user.clinic_id,
            Prescription.is_deleted == False,
        )
        .order_by(desc(Prescription.prescribed_at), desc(Prescription.created_at))
    )
    if status:
        query = query.where(Prescription.status == PrescriptionStatus(status))
    result = await session.execute(query)
    prescriptions = list(result.scalars().all())
    return [_prescription_to_dict(p) for p in prescriptions]


@router.get("/{patient_id}/prescriptions/{prescription_id}")
async def get_prescription(
    patient_id: uuid.UUID, prescription_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
):
    from app.models.medication import Prescription
    query = select(Prescription).where(
        Prescription.id == prescription_id,
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id,
        Prescription.is_deleted == False,
    )
    result = await session.execute(query)
    p = result.scalar_one_or_none()
    if not p:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Prescription", str(prescription_id))
    return _prescription_to_dict(p)


@router.post("/{patient_id}/prescriptions", status_code=201)
async def create_prescription(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    """Create an empty prescription. Add items via the items endpoint."""
    from app.models.medication import Prescription, PrescriptionStatus
    now = datetime.now(timezone.utc)
    prescription = Prescription(
        id=uuid.uuid4(),
        patient_id=patient_id,
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
        status=PrescriptionStatus.ACTIVE,
        prescribed_at=now,
    )
    session.add(prescription)
    await session.flush()
    await session.refresh(prescription)
    await session.commit()
    return _prescription_to_dict(prescription)


@router.post("/{patient_id}/prescriptions/{prescription_id}/items", status_code=201)
async def add_prescription_item(
    patient_id: uuid.UUID,
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    drug_id: uuid.UUID = Query(...),
    dosage: str | None = None,
    frequency: str | None = None,
    route: str = "ORAL",
    duration_days: int | None = None,
    quantity: int | None = None,
    is_prn: bool = False,
    notes: str | None = None,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    from app.models.medication import Prescription, PrescriptionItem, RouteOfAdministration, Drug
    # Verify prescription exists and belongs to patient
    query = select(Prescription).where(
        Prescription.id == prescription_id,
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id,
        Prescription.is_deleted == False,
    )
    result = await session.execute(query)
    prescription = result.scalar_one_or_none()
    if not prescription:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Prescription", str(prescription_id))

    # Verify drug exists
    drug_q = select(Drug).where(Drug.id == drug_id, Drug.is_deleted == False)
    drug_result = await session.execute(drug_q)
    drug = drug_result.scalar_one_or_none()
    if not drug:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Drug", str(drug_id))

    try:
        route_enum = RouteOfAdministration(route)
    except ValueError:
        route_enum = RouteOfAdministration.ORAL

    item = PrescriptionItem(
        id=uuid.uuid4(),
        prescription_id=prescription_id,
        drug_id=drug_id,
        dosage=dosage,
        frequency=frequency,
        route=route_enum,
        duration_days=duration_days,
        quantity=quantity,
        is_prn=is_prn,
        notes=notes,
        clinic_id=current_user.clinic_id,
    )
    session.add(item)
    await session.flush()
    await session.refresh(item)
    await session.commit()
    return _prescription_item_to_dict(item)


@router.patch("/{patient_id}/prescriptions/{prescription_id}")
async def update_prescription(
    patient_id: uuid.UUID, prescription_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
    status: str | None = None,
    notes: str | None = None,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    from app.models.medication import Prescription, PrescriptionStatus
    query = select(Prescription).where(
        Prescription.id == prescription_id,
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id,
        Prescription.is_deleted == False,
    )
    result = await session.execute(query)
    p = result.scalar_one_or_none()
    if not p:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Prescription", str(prescription_id))
    if status:
        p.status = PrescriptionStatus(status)
    if notes is not None:
        p.notes = notes
    await session.flush()
    await session.refresh(p)
    await session.commit()
    return _prescription_to_dict(p)


@router.delete("/{patient_id}/prescriptions/{prescription_id}", status_code=204)
async def delete_prescription(
    patient_id: uuid.UUID, prescription_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    from app.models.medication import Prescription
    query = select(Prescription).where(
        Prescription.id == prescription_id,
        Prescription.patient_id == patient_id,
        Prescription.clinic_id == current_user.clinic_id,
        Prescription.is_deleted == False,
    )
    result = await session.execute(query)
    p = result.scalar_one_or_none()
    if not p:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Prescription", str(prescription_id))
    p.is_deleted = True
    await session.flush()
    await session.commit()


def _prescription_to_dict(p) -> dict:
    doctor_name = ""
    if p.doctor:
        doctor_name = f"{p.doctor.last_name} {p.doctor.first_name}"
    items = []
    if p.items:
        items = [_prescription_item_to_dict(item) for item in p.items if not item.is_deleted]
    return {
        "id": p.id,
        "patient_id": p.patient_id,
        "doctor_id": p.doctor_id,
        "doctor_name": doctor_name,
        "visit_id": p.visit_id,
        "treatment_plan_id": p.treatment_plan_id,
        "status": p.status.value if hasattr(p.status, "value") else str(p.status),
        "notes": p.notes,
        "prescribed_at": p.prescribed_at,
        "items": items,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


def _prescription_item_to_dict(item) -> dict:
    drug_info = None
    if item.drug:
        drug_info = {
            "id": item.drug.id,
            "name": item.drug.name,
            "generic_name": item.drug.generic_name,
            "brand": item.drug.brand,
            "form": item.drug.form.value if hasattr(item.drug.form, "value") else str(item.drug.form),
            "category": item.drug.category,
        }
    return {
        "id": item.id,
        "drug": drug_info,
        "dosage": item.dosage,
        "frequency": item.frequency,
        "route": item.route.value if hasattr(item.route, "value") else str(item.route),
        "duration_days": item.duration_days,
        "quantity": item.quantity,
        "is_prn": item.is_prn,
        "notes": item.notes,
    }


def _procedure_order_to_dict(o) -> dict:
    procedure_info = None
    if o.procedure:
        procedure_info = {
            "id": o.procedure.id,
            "name": o.procedure.name,
            "code": o.procedure.code,
            "category": o.procedure.category,
            "description": o.procedure.description,
            "duration_minutes": o.procedure.duration_minutes,
            "price": float(o.procedure.price) if o.procedure.price else None,
            "requires_consent": o.procedure.requires_consent,
        }
    ordered_by_name = ""
    if o.ordered_by:
        ordered_by_name = f"{o.ordered_by.last_name} {o.ordered_by.first_name}"
    performed_by_name = ""
    if o.performed_by:
        performed_by_name = f"{o.performed_by.last_name} {o.performed_by.first_name}"
    return {
        "id": o.id,
        "patient_id": o.patient_id,
        "procedure": procedure_info,
        "status": o.status.value if hasattr(o.status, "value") else str(o.status),
        "ordered_by_id": o.ordered_by_id,
        "ordered_by_name": ordered_by_name,
        "performed_by_id": o.performed_by_id,
        "performed_by_name": performed_by_name,
        "treatment_plan_id": o.treatment_plan_id,
        "scheduled_at": o.scheduled_at,
        "started_at": o.started_at,
        "completed_at": o.completed_at,
        "notes": o.notes,
        "consent_signed": o.consent_signed,
        "created_at": o.created_at,
        "updated_at": o.updated_at,
    }


# --- Documents ---
@router.get("/{patient_id}/documents")
async def list_documents(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    category: str | None = None,
):
    from app.models.document import Document, DocumentCategory
    query = (
        select(Document)
        .where(Document.patient_id == patient_id, Document.clinic_id == current_user.clinic_id, Document.is_deleted == False)
        .order_by(desc(Document.uploaded_at), desc(Document.created_at))
    )
    if category:
        query = query.where(Document.category == DocumentCategory(category))
    result = await session.execute(query)
    return [_document_to_dict(d) for d in result.scalars().all()]


@router.post("/{patient_id}/documents", status_code=201)
async def upload_document(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("other"),
    description: str = Form(""),
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
):
    import os
    from app.models.document import Document, DocumentCategory

    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(400, "File too large (max 50MB)")

    ext = os.path.splitext(file.filename or "file")[1] or ".bin"
    saved_name = f"doc-{uuid.uuid4()}{ext}"
    with open(os.path.join(UPLOAD_DIR, saved_name), "wb") as f:
        f.write(content)

    now = datetime.now(timezone.utc)
    doc = Document(
        id=uuid.uuid4(),
        patient_id=patient_id,
        clinic_id=current_user.clinic_id,
        title=title,
        category=DocumentCategory(category),
        file_url=f"/uploads/{saved_name}",
        file_name=file.filename or saved_name,
        file_size=len(content),
        mime_type=file.content_type,
        description=description or None,
        uploaded_by_id=current_user.id,
        uploaded_at=now,
    )
    session.add(doc)
    await session.flush()
    await session.refresh(doc)
    await session.commit()
    return _document_to_dict(doc)


@router.delete("/{patient_id}/documents/{document_id}", status_code=204)
async def delete_document(
    patient_id: uuid.UUID, document_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    from app.models.document import Document
    query = select(Document).where(
        Document.id == document_id, Document.patient_id == patient_id,
        Document.clinic_id == current_user.clinic_id, Document.is_deleted == False,
    )
    result = await session.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", str(document_id))
    doc.is_deleted = True
    await session.flush()
    await session.commit()


def _document_to_dict(d) -> dict:
    uploader = ""
    if d.uploaded_by:
        uploader = f"{d.uploaded_by.last_name} {d.uploaded_by.first_name}"
    return {
        "id": d.id,
        "patient_id": d.patient_id,
        "title": d.title,
        "category": d.category.value if hasattr(d.category, "value") else str(d.category),
        "file_url": d.file_url,
        "file_name": d.file_name,
        "file_size": d.file_size,
        "mime_type": d.mime_type,
        "description": d.description,
        "uploaded_by_name": uploader,
        "uploaded_at": d.uploaded_at,
        "created_at": d.created_at,
    }


# --- Appointments ---
@router.get("/{patient_id}/appointments")
async def list_patient_appointments(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
):
    from app.models.appointment import Appointment
    query = (
        select(Appointment)
        .where(Appointment.patient_id == patient_id, Appointment.clinic_id == current_user.clinic_id, Appointment.is_deleted == False)
        .order_by(desc(Appointment.scheduled_start))
    )
    result = await session.execute(query)
    return [_appointment_to_dict(a) for a in result.scalars().all()]


def _appointment_to_dict(a) -> dict:
    patient_name = ""
    if a.patient:
        patient_name = f"{a.patient.last_name} {a.patient.first_name}"
    doctor_name = ""
    if a.doctor:
        doctor_name = f"{a.doctor.last_name} {a.doctor.first_name}"
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": patient_name,
        "doctor_id": a.doctor_id,
        "doctor_name": doctor_name,
        "appointment_type": a.appointment_type.value if hasattr(a.appointment_type, "value") else str(a.appointment_type),
        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        "scheduled_start": a.scheduled_start,
        "scheduled_end": a.scheduled_end,
        "actual_start": a.actual_start,
        "actual_end": a.actual_end,
        "reason": a.reason,
        "notes": a.notes,
        "is_walk_in": a.is_walk_in,
        "queue_number": a.queue_number,
        "created_at": a.created_at,
    }
