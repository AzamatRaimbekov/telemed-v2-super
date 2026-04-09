import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import User, UserRole
from app.models.facility import Department, Room, Bed, BedStatus
from app.models.patient import Patient
from app.core.exceptions import ConflictError, ValidationError

router = APIRouter(tags=["Registration"])


# --- OCR Passport (placeholder - needs Tesseract in prod) ---
@router.post("/ocr/passport")
async def ocr_passport(file: UploadFile = File(...)):
    """Process passport image with OCR. Returns extracted fields with confidence scores."""
    if not file.content_type or not file.content_type.startswith(("image/", "application/pdf")):
        raise ValidationError("Unsupported file type. Use JPG, PNG, HEIC or PDF.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise ValidationError("File too large. Maximum 10 MB.")

    # In production: OpenCV preprocessing + Tesseract OCR
    # For now return a structured response showing the API contract
    return {
        "confidence": 0.0,
        "last_name": "",
        "first_name": "",
        "middle_name": "",
        "date_of_birth": None,
        "gender": None,
        "passport_series": "",
        "passport_number": "",
        "inn": "",
        "issued_by": "",
        "issued_date": None,
        "valid_until": None,
        "address": "",
        "nationality": "KG",
        "fields_detected": [],
        "message": "OCR processing requires Tesseract installation. Fields returned empty for manual entry."
    }


# --- Camera faces (placeholder for DeepFace) ---
@router.get("/camera/faces")
async def get_detected_faces(clinic_id: uuid.UUID = Query(...), current_user: CurrentUser = None):
    """Get recently detected faces from clinic cameras. Returns face snapshots from Redis."""
    # In production: read from Redis key clinic:{id}:faces
    return {"faces": [], "total": 0, "message": "Camera face detection requires DeepFace setup."}


@router.post("/camera/manual-capture")
async def manual_capture(current_user: CurrentUser = None):
    """Save a manually captured face photo."""
    return {"snapshot_id": None, "message": "Manual capture endpoint ready."}


# --- Duplicate validation ---
@router.get("/patients/validate")
async def validate_patient(
    session: DBSession, current_user: CurrentUser,
    inn: str | None = None, passport_number: str | None = None,
):
    """Check for duplicate patients by INN or passport number."""
    result = {"inn_duplicate": False, "passport_duplicate": False, "existing_patient": None}

    if inn:
        query = select(Patient).where(
            Patient.inn == inn, Patient.clinic_id == current_user.clinic_id, Patient.is_deleted == False
        )
        existing = await session.execute(query)
        patient = existing.scalar_one_or_none()
        if patient:
            result["inn_duplicate"] = True
            result["existing_patient"] = {
                "id": str(patient.id),
                "full_name": f"{patient.last_name} {patient.first_name} {patient.middle_name or ''}".strip(),
                "url": f"/patients/{patient.id}",
            }

    if passport_number and not result["inn_duplicate"]:
        query = select(Patient).where(
            Patient.passport_number == passport_number, Patient.clinic_id == current_user.clinic_id, Patient.is_deleted == False
        )
        existing = await session.execute(query)
        patient = existing.scalar_one_or_none()
        if patient:
            result["passport_duplicate"] = True
            if not result["existing_patient"]:
                result["existing_patient"] = {
                    "id": str(patient.id),
                    "full_name": f"{patient.last_name} {patient.first_name} {patient.middle_name or ''}".strip(),
                    "url": f"/patients/{patient.id}",
                }

    return result


# --- Staff lookup with load ---
@router.get("/doctors")
async def list_doctors(
    session: DBSession, current_user: CurrentUser,
    with_load: bool = Query(False),
):
    """List doctors for the current clinic with optional patient load info."""
    query = select(User).where(
        User.clinic_id == current_user.clinic_id,
        User.role == UserRole.DOCTOR,
        User.is_active == True,
        User.is_deleted == False,
    )
    result = await session.execute(query)
    doctors = result.scalars().all()

    items = []
    for d in doctors:
        item = {
            "id": str(d.id),
            "first_name": d.first_name,
            "last_name": d.last_name,
            "middle_name": d.middle_name,
            "specialization": d.specialization,
            "avatar_url": d.avatar_url,
        }
        if with_load:
            count_q = select(func.count()).select_from(Patient).where(
                Patient.assigned_doctor_id == d.id,
                Patient.status == "ACTIVE",
                Patient.is_deleted == False,
            )
            count_r = await session.execute(count_q)
            item["current_patients"] = count_r.scalar_one()
            item["max_patients"] = 20  # configurable per clinic
        items.append(item)

    return items


@router.get("/nurses")
async def list_nurses(session: DBSession, current_user: CurrentUser):
    """List nurses for the current clinic."""
    query = select(User).where(
        User.clinic_id == current_user.clinic_id,
        User.role == UserRole.NURSE,
        User.is_active == True,
        User.is_deleted == False,
    )
    result = await session.execute(query)
    nurses = result.scalars().all()
    return [
        {"id": str(n.id), "first_name": n.first_name, "last_name": n.last_name, "middle_name": n.middle_name}
        for n in nurses
    ]


# --- Facility lookups (cascading) ---
@router.get("/departments")
async def list_departments(session: DBSession, current_user: CurrentUser):
    query = select(Department).where(
        Department.clinic_id == current_user.clinic_id, Department.is_active == True, Department.is_deleted == False
    )
    result = await session.execute(query)
    return [{"id": str(d.id), "name": d.name, "code": d.code} for d in result.scalars().all()]


@router.get("/rooms")
async def list_rooms(department_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    query = select(Room).where(
        Room.department_id == department_id, Room.clinic_id == current_user.clinic_id,
        Room.is_active == True, Room.is_deleted == False,
    )
    result = await session.execute(query)
    return [
        {"id": str(r.id), "name": r.name, "room_number": r.room_number, "room_type": r.room_type.value, "capacity": r.capacity, "floor": r.floor}
        for r in result.scalars().all()
    ]


@router.get("/beds")
async def list_beds(room_id: uuid.UUID, session: DBSession, current_user: CurrentUser, status: str | None = None):
    query = select(Bed).where(
        Bed.room_id == room_id, Bed.clinic_id == current_user.clinic_id, Bed.is_deleted == False,
    )
    if status:
        query = query.where(Bed.status == status)
    result = await session.execute(query)
    return [
        {"id": str(b.id), "bed_number": b.bed_number, "status": b.status.value}
        for b in result.scalars().all()
    ]


# --- Emergency registration ---
@router.post("/patients/emergency", status_code=201)
async def emergency_registration(
    session: DBSession, current_user: CurrentUser,
    first_name: str = "Неизвестный",
    date_of_birth: str | None = None,
    doctor_id: uuid.UUID | None = None,
    bed_id: uuid.UUID | None = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.CLINIC_ADMIN),
):
    """Minimal emergency patient registration."""
    from app.models.medical import MedicalCard
    from app.models.facility import BedAssignment
    from datetime import date

    patient_id = uuid.uuid4()
    dob = date.fromisoformat(date_of_birth) if date_of_birth else date(1900, 1, 1)

    patient = Patient(
        id=patient_id,
        first_name=first_name,
        last_name="Экстренный",
        date_of_birth=dob,
        gender="OTHER",
        registration_source="EMERGENCY",
        status="ACTIVE",
        assigned_doctor_id=doctor_id,
        clinic_id=current_user.clinic_id,
    )
    session.add(patient)

    # Medical card
    count_q = select(func.count()).select_from(MedicalCard).where(MedicalCard.clinic_id == current_user.clinic_id)
    count_r = await session.execute(count_q)
    seq = count_r.scalar_one() + 1
    card = MedicalCard(
        id=uuid.uuid4(),
        patient_id=patient_id,
        card_number=f"MC-{datetime.now().year}-{seq:04d}",
        opened_at=datetime.now(timezone.utc),
        clinic_id=current_user.clinic_id,
    )
    session.add(card)

    # Bed assignment if provided
    if bed_id:
        bed_q = select(Bed).where(Bed.id == bed_id)
        bed_r = await session.execute(bed_q)
        bed = bed_r.scalar_one_or_none()
        if bed:
            bed.status = BedStatus.OCCUPIED
            assignment = BedAssignment(
                id=uuid.uuid4(),
                bed_id=bed_id,
                patient_id=patient_id,
                assigned_at=datetime.now(timezone.utc),
                clinic_id=current_user.clinic_id,
            )
            session.add(assignment)

    await session.flush()

    return {
        "patient_id": str(patient_id),
        "card_number": card.card_number,
        "requires_completion": True,
        "redirect_url": f"/patients/{patient_id}",
    }
