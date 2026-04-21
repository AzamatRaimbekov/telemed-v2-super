import qrcode
from io import BytesIO
import json
import uuid


def generate_patient_qr(patient_id: uuid.UUID, patient_name: str, clinic_name: str = "MedCore KG") -> BytesIO:
    """Generate QR code image for a patient."""
    data = json.dumps({
        "type": "medcore_patient",
        "id": str(patient_id),
        "v": 1,
    })

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#1A1A2E", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
