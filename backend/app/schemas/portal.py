import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


# Auth
class PortalLoginRequest(BaseModel):
    phone: str
    password: str


class PortalTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Profile
class PatientProfileOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    middle_name: str | None = None
    date_of_birth: date
    gender: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    blood_type: str
    allergies: list | None = None
    chronic_conditions: list | None = None
    insurance_provider: str | None = None
    insurance_number: str | None = None
    photo_url: str | None = None
    status: str
    assigned_doctor: dict | None = None
    assigned_nurse: dict | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class PatientProfileUpdate(BaseModel):
    phone: str | None = None
    email: str | None = None
    address: str | None = None


# Medical Card
class MedicalCardOut(BaseModel):
    id: uuid.UUID
    card_number: str
    opened_at: datetime
    notes: str | None = None
    allergies: list | None = None
    chronic_conditions: list | None = None
    model_config = {"from_attributes": True}


class VitalSignOut(BaseModel):
    id: uuid.UUID
    recorded_at: datetime
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
    model_config = {"from_attributes": True}


class DiagnosisOut(BaseModel):
    code: str
    text: str | None = None
    date: datetime
    doctor_name: str
    status: str = "active"


# Lab Results
class LabResultOut(BaseModel):
    id: uuid.UUID
    test_name: str
    test_code: str
    category: str | None = None
    value: str
    numeric_value: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    is_abnormal: bool = False
    notes: str | None = None
    status: str
    resulted_at: datetime
    approved_at: datetime | None = None
    model_config = {"from_attributes": True}


class LabResultDetailOut(LabResultOut):
    doctor_comment: str | None = None


class LabResultTrendPoint(BaseModel):
    date: datetime
    value: float
    is_abnormal: bool = False


# Billing
class BillingSummaryOut(BaseModel):
    total_amount: float = 0
    total_paid: float = 0
    insurance_covered: float = 0
    patient_balance: float = 0


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    status: str
    subtotal: float
    discount: float = 0
    tax: float = 0
    total: float
    insurance_claim_amount: float = 0
    issued_at: datetime
    due_date: date | None = None
    model_config = {"from_attributes": True}


class InvoiceDetailOut(InvoiceOut):
    items: list[dict] = []
    payments: list[dict] = []


class PaymentOut(BaseModel):
    id: uuid.UUID
    amount: float
    payment_method: str
    reference_number: str | None = None
    paid_at: datetime
    model_config = {"from_attributes": True}


# Appointments
class AppointmentOut(BaseModel):
    id: uuid.UUID
    doctor_name: str
    doctor_specialization: str | None = None
    appointment_type: str
    status: str
    scheduled_start: datetime
    scheduled_end: datetime
    reason: str | None = None
    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    doctor_id: uuid.UUID
    appointment_type: str = "CONSULTATION"
    scheduled_start: datetime
    scheduled_end: datetime
    reason: str | None = None


class SlotOut(BaseModel):
    start: datetime
    end: datetime
    available: bool = True


# Exercises
class ExerciseOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    category: str
    difficulty: str
    instructions: str | None = None
    default_sets: int
    default_reps: int
    demo_video_url: str | None = None
    is_prescribed: bool = False
    model_config = {"from_attributes": True}


class ExerciseSessionCreate(BaseModel):
    exercise_id: uuid.UUID
    treatment_plan_item_id: uuid.UUID | None = None
    reps_completed: int
    sets_completed: int
    accuracy_score: float
    duration_seconds: int
    feedback: list[str] = []
    rep_data: list[dict] = []


class ExerciseSessionOut(BaseModel):
    id: uuid.UUID
    exercise_name: str
    started_at: datetime
    completed_at: datetime | None = None
    reps_completed: int
    sets_completed: int
    accuracy_score: float
    duration_seconds: int
    model_config = {"from_attributes": True}


class ExerciseProgressOut(BaseModel):
    total_sessions: int = 0
    this_week_sessions: int = 0
    avg_accuracy: float = 0
    total_reps: int = 0
    streak_days: int = 0


# Telemedicine
class TelemedicineSessionOut(BaseModel):
    id: uuid.UUID
    doctor_name: str
    scheduled_at: datetime | None = None
    status: str
    room_id: str
    model_config = {"from_attributes": True}


class TelemedicineJoinOut(BaseModel):
    room_url: str
    token: str | None = None


# Messages
class MessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    attachment_url: str | None = None
    is_read: bool = False
    read_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    recipient_id: uuid.UUID
    content: str
    attachment_url: str | None = None


# Notifications
class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: str
    severity: str
    is_read: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}
