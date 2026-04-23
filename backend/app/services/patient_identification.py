"""
Unified Patient Identification Service.

Identifies patients by any method: wristband UID, QR code, barcode, NFC tag,
patient ID, INN, phone number. Returns full patient context.

Used by: QR scanner, wristband scanner, reception desk, any endpoint that needs
to quickly identify a patient.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.models.patient import Patient
from app.models.wristband import PatientWristband, WristbandStatus


class IdentificationMethod:
    WRISTBAND_UID = "wristband_uid"
    WRISTBAND_NFC = "wristband_nfc"
    WRISTBAND_BARCODE = "wristband_barcode"
    QR_CODE = "qr_code"
    PATIENT_ID = "patient_id"
    INN = "inn"
    PHONE = "phone"


class PatientIdentificationService:
    """Единый сервис идентификации пациента по любому методу."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def identify(self, code: str, clinic_id: uuid.UUID | None = None) -> dict | None:
        """
        Identify a patient by any code/ID.
        Tries methods in order: wristband → patient UUID → INN → phone.
        Returns full patient context or None.
        """
        # 1. Try wristband (UID, barcode, NFC)
        wristband = await self._find_wristband(code)
        if wristband:
            patient = await self._get_patient(wristband.patient_id)
            if patient:
                return await self._build_response(
                    patient, IdentificationMethod.WRISTBAND_UID, wristband
                )

        # 2. Try patient UUID
        try:
            patient_uuid = uuid.UUID(code)
            patient = await self._get_patient(patient_uuid)
            if patient:
                wristband = await self._get_active_wristband(patient.id)
                return await self._build_response(
                    patient, IdentificationMethod.PATIENT_ID, wristband
                )
        except (ValueError, AttributeError):
            pass

        # 3. Try INN
        patient = await self._find_by_inn(code)
        if patient:
            wristband = await self._get_active_wristband(patient.id)
            return await self._build_response(
                patient, IdentificationMethod.INN, wristband
            )

        # 4. Try phone
        patient = await self._find_by_phone(code)
        if patient:
            wristband = await self._get_active_wristband(patient.id)
            return await self._build_response(
                patient, IdentificationMethod.PHONE, wristband
            )

        return None

    async def _find_wristband(self, code: str) -> PatientWristband | None:
        """Search by wristband UID, barcode, or NFC tag."""
        code_upper = code.upper().strip()
        result = await self.db.execute(
            select(PatientWristband).where(and_(
                or_(
                    PatientWristband.wristband_uid == code_upper,
                    PatientWristband.barcode == code_upper,
                    PatientWristband.nfc_tag_id == code,
                ),
                PatientWristband.status == WristbandStatus.ACTIVE,
            ))
        )
        return result.scalar_one_or_none()

    async def _get_patient(self, patient_id: uuid.UUID) -> Patient | None:
        result = await self.db.execute(
            select(Patient).where(and_(
                Patient.id == patient_id,
                Patient.is_deleted == False,
            ))
        )
        return result.scalar_one_or_none()

    async def _find_by_inn(self, inn: str) -> Patient | None:
        if not inn or len(inn) < 5:
            return None
        result = await self.db.execute(
            select(Patient).where(and_(
                Patient.inn == inn,
                Patient.is_deleted == False,
            ))
        )
        return result.scalar_one_or_none()

    async def _find_by_phone(self, phone: str) -> Patient | None:
        if not phone or len(phone) < 7:
            return None
        # Normalize phone
        clean = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        result = await self.db.execute(
            select(Patient).where(and_(
                Patient.phone == clean,
                Patient.is_deleted == False,
            ))
        )
        return result.scalar_one_or_none()

    async def _get_active_wristband(self, patient_id: uuid.UUID) -> PatientWristband | None:
        result = await self.db.execute(
            select(PatientWristband).where(and_(
                PatientWristband.patient_id == patient_id,
                PatientWristband.status == WristbandStatus.ACTIVE,
            ))
        )
        return result.scalar_one_or_none()

    async def _build_response(self, patient: Patient, method: str,
                               wristband: PatientWristband | None = None) -> dict:
        """Build full patient identification response."""
        return {
            "identified": True,
            "method": method,
            "patient": {
                "id": str(patient.id),
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "middle_name": getattr(patient, "middle_name", None),
                "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
                "gender": getattr(patient, "gender", None),
                "phone": getattr(patient, "phone", None),
                "inn": getattr(patient, "inn", None),
                "blood_type": getattr(patient, "blood_type", None),
                "allergies": getattr(patient, "allergies", None),
                "chronic_diseases": getattr(patient, "chronic_diseases", None),
            },
            "wristband": {
                "id": str(wristband.id),
                "uid": wristband.wristband_uid,
                "barcode": wristband.barcode,
                "nfc_tag_id": wristband.nfc_tag_id,
                "status": wristband.status.value if hasattr(wristband.status, 'value') else str(wristband.status),
                "issued_at": wristband.issued_at.isoformat() if wristband.issued_at else None,
            } if wristband else None,
            "identified_at": datetime.now(timezone.utc).isoformat(),
        }
