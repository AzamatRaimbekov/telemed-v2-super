from typing import Optional
import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin

class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"

class BloodType(str, enum.Enum):
    A_POS = "A_POS"
    A_NEG = "A_NEG"
    B_POS = "B_POS"
    B_NEG = "B_NEG"
    AB_POS = "AB_POS"
    AB_NEG = "AB_NEG"
    O_POS = "O_POS"
    O_NEG = "O_NEG"
    UNKNOWN = "UNKNOWN"

class RegistrationSource(str, enum.Enum):
    WALK_IN = "WALK_IN"
    ONLINE = "ONLINE"
    REFERRAL = "REFERRAL"
    EMERGENCY = "EMERGENCY"

class PatientStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISCHARGED = "DISCHARGED"
    DECEASED = "DECEASED"
    TRANSFERRED = "TRANSFERRED"

class Patient(TenantMixin, Base):
    __tablename__ = "patients"
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[Gender]] = mapped_column(Enum(Gender))
    passport_number: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    inn: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    address: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(50))
    blood_type: Mapped[BloodType] = mapped_column(Enum(BloodType), default=BloodType.UNKNOWN)
    allergies: Mapped[Optional[dict]] = mapped_column(JSON)
    chronic_conditions: Mapped[Optional[dict]] = mapped_column(JSON)
    insurance_provider: Mapped[Optional[str]] = mapped_column(String(255))
    insurance_number: Mapped[Optional[str]] = mapped_column(String(100))
    assigned_doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_nurse_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    registration_source: Mapped[RegistrationSource] = mapped_column(Enum(RegistrationSource), default=RegistrationSource.WALK_IN)
    status: Mapped[PatientStatus] = mapped_column(Enum(PatientStatus), default=PatientStatus.ACTIVE)
    portal_password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    last_portal_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notification_preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    voice_settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    assigned_doctor = relationship("User", foreign_keys=[assigned_doctor_id], lazy="selectin")
    assigned_nurse = relationship("User", foreign_keys=[assigned_nurse_id], lazy="selectin")
    medical_card = relationship("MedicalCard", back_populates="patient", uselist=False, lazy="selectin")
    guardians = relationship("PatientGuardian", back_populates="patient", lazy="selectin")

class PatientGuardian(TenantMixin, Base):
    __tablename__ = "patient_guardians"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    guardian_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    relationship_type: Mapped[Optional[str]] = mapped_column(String(100))
    can_book_appointments: Mapped[bool] = mapped_column(Boolean, default=True)
    can_view_billing: Mapped[bool] = mapped_column(Boolean, default=True)
    patient = relationship("Patient", back_populates="guardians")
    guardian = relationship("User", foreign_keys=[guardian_user_id], lazy="selectin")
