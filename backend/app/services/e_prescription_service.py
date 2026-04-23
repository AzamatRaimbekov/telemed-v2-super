from __future__ import annotations

import json
import secrets
import string
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.e_prescription import EPrescription, PrescriptionStatus


def generate_prescription_code() -> str:
    """Generate a unique prescription code in format RX-XXXXXXXX (8 alphanumeric)."""
    chars = string.ascii_uppercase + string.digits
    random_part = "".join(secrets.choice(chars) for _ in range(8))
    return f"RX-{random_part}"


async def create_prescription(
    session: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    doctor_id: uuid.UUID,
    medications: list[dict],
    diagnosis_code: str | None = None,
    diagnosis_name: str | None = None,
    instructions: str | None = None,
    is_urgent: bool = False,
    max_refills: int = 0,
    valid_days: int = 30,
) -> EPrescription:
    """Create a new e-prescription with auto-generated code."""
    code = generate_prescription_code()
    # Ensure uniqueness
    for _ in range(5):
        existing = await session.execute(
            select(EPrescription).where(EPrescription.prescription_code == code)
        )
        if existing.scalar_one_or_none() is None:
            break
        code = generate_prescription_code()

    prescription = EPrescription(
        clinic_id=clinic_id,
        prescription_code=code,
        patient_id=patient_id,
        doctor_id=doctor_id,
        medications=medications,
        diagnosis_code=diagnosis_code,
        diagnosis_name=diagnosis_name,
        instructions=instructions,
        is_urgent=is_urgent,
        max_refills=max_refills,
        status=PrescriptionStatus.ACTIVE,
        valid_until=date.today() + timedelta(days=valid_days),
    )
    session.add(prescription)
    await session.commit()
    await session.refresh(prescription)
    return prescription


async def get_by_code(session: AsyncSession, code: str) -> EPrescription | None:
    """Lookup prescription by code (for QR scanning at pharmacy)."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.prescription_code == code,
            EPrescription.is_deleted == False,
        )
    )
    return result.scalar_one_or_none()


async def dispense(
    session: AsyncSession,
    prescription: EPrescription,
    pharmacist_id: uuid.UUID,
) -> EPrescription:
    """Mark prescription as dispensed."""
    prescription.status = PrescriptionStatus.DISPENSED
    prescription.dispensed_at = date.today()
    prescription.dispensed_by_id = pharmacist_id
    await session.commit()
    await session.refresh(prescription)
    return prescription


def get_qr_data(prescription: EPrescription) -> dict:
    """Return data for QR code generation."""
    return {
        "code": prescription.prescription_code,
        "patient_id": str(prescription.patient_id),
        "doctor_id": str(prescription.doctor_id),
        "status": prescription.status.value if hasattr(prescription.status, "value") else str(prescription.status),
        "medications": prescription.medications,
        "valid_until": prescription.valid_until.isoformat() if prescription.valid_until else None,
        "is_urgent": prescription.is_urgent,
    }
