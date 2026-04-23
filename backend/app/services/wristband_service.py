import uuid
import random
import string
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.wristband import PatientWristband, WristbandStatus


def generate_wristband_uid() -> str:
    """Generate unique wristband ID: MC-XXXXXX (6 alphanumeric chars)."""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=6))
    return f"MC-{code}"


class WristbandService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def issue_wristband(self, patient_id: uuid.UUID, clinic_id: uuid.UUID,
                               issued_by_id: uuid.UUID | None = None,
                               nfc_tag_id: str | None = None) -> PatientWristband:
        """Issue a new wristband to a patient. Deactivates any existing active wristband."""
        # Deactivate existing active wristbands
        existing = await self.db.execute(
            select(PatientWristband).where(and_(
                PatientWristband.patient_id == patient_id,
                PatientWristband.status == WristbandStatus.ACTIVE,
            ))
        )
        for wb in existing.scalars().all():
            wb.status = WristbandStatus.DEACTIVATED
            wb.deactivated_at = datetime.now(timezone.utc)

        # Generate unique UID
        uid = generate_wristband_uid()
        for _ in range(10):
            check = await self.db.execute(
                select(PatientWristband).where(PatientWristband.wristband_uid == uid)
            )
            if not check.scalar_one_or_none():
                break
            uid = generate_wristband_uid()

        wristband = PatientWristband(
            patient_id=patient_id,
            clinic_id=clinic_id,
            wristband_uid=uid,
            barcode=uid.replace("-", ""),  # barcode-friendly version
            nfc_tag_id=nfc_tag_id,
            status=WristbandStatus.ACTIVE,
            issued_at=datetime.now(timezone.utc),
            issued_by_id=issued_by_id,
        )
        self.db.add(wristband)
        await self.db.commit()
        await self.db.refresh(wristband)
        return wristband

    async def scan_wristband(self, wristband_uid: str):
        """Look up patient by wristband UID, barcode, or NFC tag."""
        # Try UID first
        result = await self.db.execute(
            select(PatientWristband).where(and_(
                PatientWristband.wristband_uid == wristband_uid.upper(),
                PatientWristband.status == WristbandStatus.ACTIVE,
            ))
        )
        wb = result.scalar_one_or_none()

        if not wb:
            # Try barcode
            result = await self.db.execute(
                select(PatientWristband).where(and_(
                    PatientWristband.barcode == wristband_uid,
                    PatientWristband.status == WristbandStatus.ACTIVE,
                ))
            )
            wb = result.scalar_one_or_none()

        if not wb:
            # Try NFC
            result = await self.db.execute(
                select(PatientWristband).where(and_(
                    PatientWristband.nfc_tag_id == wristband_uid,
                    PatientWristband.status == WristbandStatus.ACTIVE,
                ))
            )
            wb = result.scalar_one_or_none()

        return wb

    async def get_patient_wristband(self, patient_id: uuid.UUID) -> PatientWristband | None:
        """Get active wristband for a patient."""
        result = await self.db.execute(
            select(PatientWristband).where(and_(
                PatientWristband.patient_id == patient_id,
                PatientWristband.status == WristbandStatus.ACTIVE,
            ))
        )
        return result.scalar_one_or_none()

    async def deactivate(self, wristband_id: uuid.UUID, reason: str = "discharged"):
        result = await self.db.execute(
            select(PatientWristband).where(PatientWristband.id == wristband_id)
        )
        wb = result.scalar_one_or_none()
        if wb:
            wb.status = WristbandStatus.DISCHARGED if reason == "discharged" else WristbandStatus.DEACTIVATED
            wb.deactivated_at = datetime.now(timezone.utc)
            await self.db.commit()
        return wb

    async def report_lost(self, wristband_id: uuid.UUID):
        result = await self.db.execute(
            select(PatientWristband).where(PatientWristband.id == wristband_id)
        )
        wb = result.scalar_one_or_none()
        if wb:
            wb.status = WristbandStatus.LOST
            wb.deactivated_at = datetime.now(timezone.utc)
            await self.db.commit()
        return wb

    async def get_history(self, patient_id: uuid.UUID):
        result = await self.db.execute(
            select(PatientWristband).where(
                PatientWristband.patient_id == patient_id
            ).order_by(PatientWristband.issued_at.desc())
        )
        return result.scalars().all()
