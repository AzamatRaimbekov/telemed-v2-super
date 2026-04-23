from __future__ import annotations

import io
import json
import uuid
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.e_prescription import EPrescription, PrescriptionStatus
from app.services import e_prescription_service as svc

router = APIRouter(prefix="/e-prescriptions", tags=["E-Prescriptions"])


# ---------- schemas ----------

class CreatePrescriptionRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str | None = None
    diagnosis_name: str | None = None
    medications: list[dict]
    instructions: str | None = None
    is_urgent: bool = False
    max_refills: int = 0
    valid_days: int = 30


class DispenseRequest(BaseModel):
    pharmacist_id: uuid.UUID | None = None


# ---------- helpers ----------

def _rx_to_dict(rx: EPrescription) -> dict:
    return {
        "id": str(rx.id),
        "prescription_code": rx.prescription_code,
        "patient_id": str(rx.patient_id),
        "doctor_id": str(rx.doctor_id),
        "diagnosis_code": rx.diagnosis_code,
        "diagnosis_name": rx.diagnosis_name,
        "medications": rx.medications,
        "instructions": rx.instructions,
        "status": rx.status.value if hasattr(rx.status, "value") else str(rx.status),
        "valid_until": rx.valid_until.isoformat() if rx.valid_until else None,
        "dispensed_at": rx.dispensed_at.isoformat() if rx.dispensed_at else None,
        "dispensed_by_id": str(rx.dispensed_by_id) if rx.dispensed_by_id else None,
        "is_urgent": rx.is_urgent,
        "refill_count": rx.refill_count,
        "max_refills": rx.max_refills,
        "created_at": rx.created_at.isoformat(),
        "updated_at": rx.updated_at.isoformat(),
    }


def _generate_qr_svg(data: str, size: int = 200) -> str:
    """Generate a simple QR-placeholder SVG (real QR needs qrcode lib)."""
    try:
        import qrcode
        import qrcode.image.svg
        factory = qrcode.image.svg.SvgPathImage
        img = qrcode.make(data, image_factory=factory, box_size=10)
        stream = io.BytesIO()
        img.save(stream)
        return stream.getvalue().decode("utf-8")
    except ImportError:
        # Fallback: return a placeholder SVG with the code text
        escaped = data.replace("&", "&amp;").replace("<", "&lt;")
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}" fill="#f0f0f0" stroke="#333" stroke-width="2"/>'
            f'<text x="{size//2}" y="{size//2 - 10}" text-anchor="middle" font-size="12" font-family="monospace">QR Code</text>'
            f'<text x="{size//2}" y="{size//2 + 10}" text-anchor="middle" font-size="10" font-family="monospace">{escaped[:20]}</text>'
            f'</svg>'
        )


# ---------- endpoints ----------

@router.post("/")
async def create_prescription(
    body: CreatePrescriptionRequest,
    session: DBSession,
    current_user: CurrentUser,
):
    """Create a new e-prescription."""
    rx = await svc.create_prescription(
        session,
        clinic_id=current_user.clinic_id,
        patient_id=body.patient_id,
        doctor_id=current_user.id,
        medications=body.medications,
        diagnosis_code=body.diagnosis_code,
        diagnosis_name=body.diagnosis_name,
        instructions=body.instructions,
        is_urgent=body.is_urgent,
        max_refills=body.max_refills,
        valid_days=body.valid_days,
    )
    return _rx_to_dict(rx)


@router.get("/")
async def list_prescriptions(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    doctor_id: uuid.UUID | None = None,
    status: PrescriptionStatus | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """List e-prescriptions with filters."""
    q = (
        select(EPrescription)
        .where(
            EPrescription.clinic_id == current_user.clinic_id,
            EPrescription.is_deleted == False,
        )
    )
    if patient_id:
        q = q.where(EPrescription.patient_id == patient_id)
    if doctor_id:
        q = q.where(EPrescription.doctor_id == doctor_id)
    if status:
        q = q.where(EPrescription.status == status)

    q = q.order_by(EPrescription.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(q)
    return [_rx_to_dict(rx) for rx in result.scalars().all()]


@router.get("/code/{code}")
async def get_prescription_by_code(
    code: str,
    session: DBSession,
    current_user: CurrentUser,
):
    """Lookup prescription by code (for pharmacy QR scanning)."""
    rx = await svc.get_by_code(session, code)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return _rx_to_dict(rx)


@router.get("/{prescription_id}")
async def get_prescription(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get e-prescription detail."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.id == prescription_id,
            EPrescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return _rx_to_dict(rx)


@router.post("/{prescription_id}/dispense")
async def dispense_prescription(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    body: DispenseRequest | None = None,
):
    """Mark prescription as dispensed."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.id == prescription_id,
            EPrescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    status_val = rx.status.value if hasattr(rx.status, "value") else str(rx.status)
    if status_val != PrescriptionStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Only active prescriptions can be dispensed")

    pharmacist_id = (body.pharmacist_id if body and body.pharmacist_id else current_user.id)
    rx = await svc.dispense(session, rx, pharmacist_id)
    return _rx_to_dict(rx)


@router.get("/{prescription_id}/qr")
async def get_prescription_qr(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get QR code image for a prescription (PNG if qrcode lib available, else SVG)."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.id == prescription_id,
            EPrescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    qr_data = svc.get_qr_data(rx)
    qr_json = json.dumps(qr_data, ensure_ascii=False, default=str)

    # Try to generate PNG with qrcode lib
    try:
        import qrcode
        img = qrcode.make(qr_json)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="image/png")
    except ImportError:
        svg = _generate_qr_svg(rx.prescription_code)
        return Response(content=svg, media_type="image/svg+xml")


@router.get("/{prescription_id}/print")
async def print_prescription(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Get printable HTML prescription with QR code."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.id == prescription_id,
            EPrescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    qr_data = svc.get_qr_data(rx)
    qr_json = json.dumps(qr_data, ensure_ascii=False, default=str)
    qr_svg = _generate_qr_svg(rx.prescription_code)

    valid_str = rx.valid_until.strftime("%d.%m.%Y") if rx.valid_until else "---"
    status_labels = {
        "active": "Активный",
        "dispensed": "Выдан",
        "expired": "Истёк",
        "cancelled": "Отменён",
    }
    status_val = rx.status.value if hasattr(rx.status, "value") else str(rx.status)
    status_text = status_labels.get(status_val, status_val)
    urgent_badge = '<span style="color:red;font-weight:bold;">СРОЧНО</span>' if rx.is_urgent else ""

    meds_html = ""
    if isinstance(rx.medications, list):
        for i, med in enumerate(rx.medications, 1):
            name = med.get("name", "---")
            dosage = med.get("dosage", "")
            freq = med.get("frequency", "")
            dur = med.get("duration", "")
            qty = med.get("quantity", "")
            meds_html += f"""
            <tr>
                <td>{i}</td>
                <td><strong>{name}</strong></td>
                <td>{dosage}</td>
                <td>{freq}</td>
                <td>{dur}</td>
                <td>{qty}</td>
            </tr>"""

    instructions_html = ""
    if rx.instructions:
        instructions_html = f"""
        <div class="section">
            <h3>Указания</h3>
            <p>{rx.instructions}</p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Электронный рецепт {rx.prescription_code}</title>
<style>
@page {{ size: A4; margin: 15mm; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 12pt;
    line-height: 1.5;
    padding: 20mm;
    color: #000;
}}
.header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
}}
.header-left h1 {{
    font-size: 16pt;
    margin-bottom: 3px;
}}
.header-left h2 {{
    font-size: 13pt;
    font-weight: normal;
}}
.info-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
}}
.info-item {{
    display: flex;
    gap: 8px;
}}
.info-label {{
    font-weight: bold;
    min-width: 160px;
}}
table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
}}
th, td {{
    border: 1px solid #333;
    padding: 6px 10px;
    text-align: left;
}}
th {{
    background: #f0f0f0;
}}
.section {{
    margin-bottom: 15px;
}}
.section h3 {{
    font-size: 13pt;
    border-bottom: 1px solid #666;
    padding-bottom: 3px;
    margin-bottom: 8px;
}}
.footer {{
    margin-top: 40px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}}
.signature-line {{
    border-bottom: 1px solid #000;
    margin-top: 40px;
    padding-bottom: 3px;
}}
@media print {{
    body {{ padding: 0; }}
}}
</style>
</head>
<body>
<div class="header">
    <div class="header-left">
        <h1>ЭЛЕКТРОННЫЙ РЕЦЕПТ {urgent_badge}</h1>
        <h2>Код: {rx.prescription_code}</h2>
    </div>
    <div class="qr-code">{qr_svg}</div>
</div>

<div class="info-grid">
    <div class="info-item"><span class="info-label">Статус:</span> {status_text}</div>
    <div class="info-item"><span class="info-label">Действителен до:</span> {valid_str}</div>
    <div class="info-item"><span class="info-label">Диагноз (МКБ-10):</span> {rx.diagnosis_code or '---'}</div>
    <div class="info-item"><span class="info-label">Диагноз:</span> {rx.diagnosis_name or '---'}</div>
</div>

<div class="section">
    <h3>Назначения</h3>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Препарат</th>
                <th>Дозировка</th>
                <th>Частота</th>
                <th>Длительность</th>
                <th>Кол-во</th>
            </tr>
        </thead>
        <tbody>
            {meds_html}
        </tbody>
    </table>
</div>
{instructions_html}

<div class="footer">
    <div>
        <div>Врач:</div>
        <div class="signature-line"></div>
    </div>
    <div>
        <div>Дата: {datetime.now().strftime('%d.%m.%Y')}</div>
    </div>
</div>

<div style="text-align: center; margin-top: 30px; font-size: 9pt; color: #666;">
    MedCore KG | {datetime.now().strftime('%d.%m.%Y %H:%M')}
</div>
</body>
</html>"""

    return HTMLResponse(content=html)


@router.post("/{prescription_id}/cancel")
async def cancel_prescription(
    prescription_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Cancel a prescription."""
    result = await session.execute(
        select(EPrescription).where(
            EPrescription.id == prescription_id,
            EPrescription.is_deleted == False,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    status_val = rx.status.value if hasattr(rx.status, "value") else str(rx.status)
    if status_val in (PrescriptionStatus.DISPENSED.value, PrescriptionStatus.CANCELLED.value):
        raise HTTPException(status_code=400, detail="Cannot cancel a dispensed or already cancelled prescription")

    rx.status = PrescriptionStatus.CANCELLED
    await session.commit()
    await session.refresh(rx)
    return _rx_to_dict(rx)
