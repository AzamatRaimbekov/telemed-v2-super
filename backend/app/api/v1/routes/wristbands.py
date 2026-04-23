from __future__ import annotations

import uuid
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.patient import Patient
from app.models.wristband import PatientWristband, WristbandStatus
from app.models.room_assignment import RoomAssignment
from app.models.medication import Prescription, PrescriptionItem, Drug
from app.services.wristband_service import WristbandService
from app.services.qr_generator import generate_patient_qr

router = APIRouter(prefix="/wristbands", tags=["Wristbands"])


# ---------- schemas ----------

class IssueWristbandRequest(BaseModel):
    patient_id: uuid.UUID
    nfc_tag_id: str | None = None


class DeactivateRequest(BaseModel):
    reason: str = "discharged"


def _wristband_to_dict(wb: PatientWristband) -> dict:
    return {
        "id": str(wb.id),
        "patient_id": str(wb.patient_id),
        "wristband_uid": wb.wristband_uid,
        "barcode": wb.barcode,
        "nfc_tag_id": wb.nfc_tag_id,
        "status": wb.status.value if isinstance(wb.status, WristbandStatus) else wb.status,
        "issued_at": wb.issued_at.isoformat() if wb.issued_at else None,
        "issued_by_id": str(wb.issued_by_id) if wb.issued_by_id else None,
        "deactivated_at": wb.deactivated_at.isoformat() if wb.deactivated_at else None,
        "notes": wb.notes,
        "created_at": wb.created_at.isoformat(),
    }


async def _get_patient_info(session, patient_id: uuid.UUID) -> dict | None:
    """Get full patient info for scan response."""
    result = await session.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return None

    # Get room assignment
    room_result = await session.execute(
        select(RoomAssignment).where(
            RoomAssignment.patient_id == patient_id,
            RoomAssignment.is_deleted == False,
        ).order_by(RoomAssignment.created_at.desc())
    )
    room_assignment = room_result.scalar_one_or_none()

    # Get active prescriptions
    prescriptions = []
    try:
        rx_result = await session.execute(
            select(Prescription).where(
                Prescription.patient_id == patient_id,
                Prescription.is_deleted == False,
            ).order_by(Prescription.created_at.desc()).limit(10)
        )
        for rx in rx_result.scalars().all():
            items_result = await session.execute(
                select(PrescriptionItem).where(PrescriptionItem.prescription_id == rx.id)
            )
            for item in items_result.scalars().all():
                drug_result = await session.execute(
                    select(Drug).where(Drug.id == item.drug_id)
                )
                drug = drug_result.scalar_one_or_none()
                if drug:
                    prescriptions.append({
                        "drug_name": drug.name,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                    })
    except Exception:
        pass

    allergies_list = []
    if patient.allergies:
        if isinstance(patient.allergies, list):
            allergies_list = patient.allergies
        elif isinstance(patient.allergies, dict):
            allergies_list = patient.allergies.get("items", [])

    return {
        "id": str(patient.id),
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "middle_name": patient.middle_name,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
        "gender": patient.gender.value if patient.gender else None,
        "blood_type": patient.blood_type.value if patient.blood_type else None,
        "allergies": allergies_list,
        "phone": patient.phone,
        "photo_url": patient.photo_url,
        "status": patient.status.value if patient.status else None,
        "room_assignment": {
            "room_id": str(room_assignment.room_id) if room_assignment else None,
            "bed_number": getattr(room_assignment, "bed_number", None) if room_assignment else None,
        } if room_assignment else None,
        "active_medications": prescriptions,
    }


# ---------- endpoints ----------

@router.post("/issue")
async def issue_wristband(
    body: IssueWristbandRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Issue a new wristband to a patient."""
    # Verify patient exists
    result = await session.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    service = WristbandService(session)
    wb = await service.issue_wristband(
        patient_id=body.patient_id,
        clinic_id=current_user.clinic_id,
        issued_by_id=current_user.id,
        nfc_tag_id=body.nfc_tag_id,
    )
    return _wristband_to_dict(wb)


@router.get("/scan/{code}")
async def scan_wristband(
    code: str,
    session: DBSession,
    current_user: CurrentUser,
):
    """Scan a wristband by UID, barcode, or NFC tag ID. Uses unified PatientIdentificationService."""
    from app.services.patient_identification import PatientIdentificationService
    id_service = PatientIdentificationService(session)
    result = await id_service.identify(code, current_user.clinic_id)
    if not result:
        raise HTTPException(status_code=404, detail="Браслет не найден или деактивирован")
    return result


@router.get("/patient/{patient_id}")
async def get_patient_wristband(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get active wristband for a patient."""
    service = WristbandService(session)
    wb = await service.get_patient_wristband(patient_id)
    if not wb:
        raise HTTPException(status_code=404, detail="No active wristband found")
    return _wristband_to_dict(wb)


@router.get("/patient/{patient_id}/history")
async def get_wristband_history(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get wristband history for a patient."""
    service = WristbandService(session)
    history = await service.get_history(patient_id)
    return [_wristband_to_dict(wb) for wb in history]


@router.post("/{wristband_id}/deactivate")
async def deactivate_wristband(
    wristband_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    body: DeactivateRequest | None = None,
):
    """Deactivate a wristband (discharged or manual)."""
    reason = body.reason if body else "discharged"
    service = WristbandService(session)
    wb = await service.deactivate(wristband_id, reason)
    if not wb:
        raise HTTPException(status_code=404, detail="Wristband not found")
    return _wristband_to_dict(wb)


@router.post("/{wristband_id}/lost")
async def report_wristband_lost(
    wristband_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Report a wristband as lost."""
    service = WristbandService(session)
    wb = await service.report_lost(wristband_id)
    if not wb:
        raise HTTPException(status_code=404, detail="Wristband not found")
    return _wristband_to_dict(wb)


@router.get("/{wristband_id}/qr")
async def get_wristband_qr(
    wristband_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get QR code image for the wristband UID."""
    result = await session.execute(
        select(PatientWristband).where(PatientWristband.id == wristband_id)
    )
    wb = result.scalar_one_or_none()
    if not wb:
        raise HTTPException(status_code=404, detail="Wristband not found")

    # Generate QR with wristband UID as data
    import qrcode
    from io import BytesIO

    qr_data = json.dumps({
        "type": "medcore_wristband",
        "uid": wb.wristband_uid,
        "v": 1,
    })

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1A1A2E", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=wristband-{wb.wristband_uid}.png"},
    )


@router.get("/{wristband_id}/print")
async def print_wristband_label(
    wristband_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get printable wristband label HTML for thermal printer."""
    result = await session.execute(
        select(PatientWristband).where(PatientWristband.id == wristband_id)
    )
    wb = result.scalar_one_or_none()
    if not wb:
        raise HTTPException(status_code=404, detail="Wristband not found")

    patient_result = await session.execute(
        select(Patient).where(Patient.id == wb.patient_id, Patient.is_deleted == False)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    full_name = f"{patient.last_name} {patient.first_name}"
    if patient.middle_name:
        full_name += f" {patient.middle_name}"

    dob_str = str(patient.date_of_birth) if patient.date_of_birth else "---"
    blood_type_str = patient.blood_type.value.replace("_", "+").replace("POS", "+").replace("NEG", "-") if patient.blood_type else "---"

    allergies_list = []
    if patient.allergies:
        if isinstance(patient.allergies, list):
            allergies_list = patient.allergies
        elif isinstance(patient.allergies, dict):
            allergies_list = patient.allergies.get("items", [])

    allergies_html = ""
    if allergies_list:
        items = ", ".join(str(a) for a in allergies_list[:5])
        allergies_html = f'<div class="allergies">АЛЛЕРГИИ: {items}</div>'

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Браслет {wb.wristband_uid}</title>
<style>
@page {{
  size: 50mm 25mm;
  margin: 0;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  font-family: 'Arial', 'Helvetica', sans-serif;
  width: 50mm;
  padding: 2mm;
  font-size: 7pt;
  line-height: 1.3;
}}
.header {{
  text-align: center;
  font-weight: bold;
  font-size: 9pt;
  letter-spacing: 2px;
  font-family: 'Courier New', monospace;
  margin-bottom: 1mm;
  border-bottom: 0.5pt solid #000;
  padding-bottom: 1mm;
}}
.name {{
  font-weight: bold;
  font-size: 8pt;
  margin-bottom: 0.5mm;
}}
.info {{
  font-size: 6.5pt;
  color: #333;
}}
.allergies {{
  font-size: 6.5pt;
  font-weight: bold;
  color: #cc0000;
  margin-top: 1mm;
  padding: 0.5mm;
  border: 0.5pt solid #cc0000;
}}
.uid {{
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 10pt;
  font-weight: bold;
  letter-spacing: 1px;
  margin-top: 1mm;
}}
.footer {{
  text-align: center;
  font-size: 5pt;
  color: #666;
  margin-top: 1mm;
}}
@media print {{
  body {{ width: 50mm; }}
}}
</style>
</head>
<body>
<div class="header">{wb.wristband_uid}</div>
<div class="name">{full_name}</div>
<div class="info">ДР: {dob_str} | Кровь: {blood_type_str}</div>
{allergies_html}
<div class="footer">MedCore KG</div>
</body>
</html>"""

    return HTMLResponse(content=html)
