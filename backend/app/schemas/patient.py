import uuid
from datetime import date, datetime
from pydantic import BaseModel


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    middle_name: str | None = None
    date_of_birth: date
    gender: str
    passport_number: str | None = None
    inn: str | None = None
    address: str | None = None
    phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    blood_type: str = "UNKNOWN"
    allergies: list[str] | None = None
    chronic_conditions: list[str] | None = None
    insurance_provider: str | None = None
    insurance_number: str | None = None
    assigned_doctor_id: uuid.UUID | None = None
    assigned_nurse_id: uuid.UUID | None = None
    registration_source: str = "WALK_IN"
    face_snapshot_id: uuid.UUID | None = None
    portal_password: str | None = None
    bed_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    admission_type: str | None = None
    treatment_form: str | None = None
    admission_notes: str | None = None


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    blood_type: str | None = None
    allergies: list[str] | None = None
    chronic_conditions: list[str] | None = None
    insurance_provider: str | None = None
    insurance_number: str | None = None
    assigned_doctor_id: uuid.UUID | None = None
    assigned_nurse_id: uuid.UUID | None = None
    status: str | None = None


class PatientOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    middle_name: str | None = None
    date_of_birth: date
    gender: str
    passport_number: str | None = None
    inn: str | None = None
    address: str | None = None
    phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    blood_type: str
    allergies: list | None = None
    chronic_conditions: list | None = None
    insurance_provider: str | None = None
    insurance_number: str | None = None
    assigned_doctor_id: uuid.UUID | None = None
    assigned_nurse_id: uuid.UUID | None = None
    photo_url: str | None = None
    registration_source: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PatientListOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    middle_name: str | None = None
    date_of_birth: date
    gender: str
    phone: str | None = None
    status: str
    assigned_doctor_id: uuid.UUID | None = None
    blood_type: str
    created_at: datetime
    model_config = {"from_attributes": True}


class MedicalCardOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    card_number: str
    opened_at: datetime
    notes: str | None = None
    model_config = {"from_attributes": True}


class VitalSignCreate(BaseModel):
    patient_id: uuid.UUID
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    pulse: int | None = None
    temperature: float | None = None
    weight: float | None = None
    height: float | None = None
    spo2: int | None = None
    respiratory_rate: int | None = None
    blood_glucose: float | None = None
    notes: str | None = None


class VitalSignOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    recorded_at: datetime
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    pulse: int | None = None
    temperature: float | None = None
    weight: float | None = None
    spo2: int | None = None
    notes: str | None = None
    model_config = {"from_attributes": True}


class LabResultApproval(BaseModel):
    visible_to_patient: bool = True


class TreatmentPlanCreate(BaseModel):
    patient_id: uuid.UUID
    title: str
    description: str | None = None
    start_date: date
    end_date: date | None = None


class TreatmentPlanItemCreate(BaseModel):
    treatment_plan_id: uuid.UUID
    item_type: str
    title: str
    description: str | None = None
    configuration: dict | None = None
    assigned_to_id: uuid.UUID | None = None
    frequency: str | None = None
    start_date: date
    end_date: date | None = None
    sort_order: int = 0
