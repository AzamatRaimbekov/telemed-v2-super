from app.services.qr_generator import generate_patient_qr
import uuid

def test_qr_generation():
    buffer = generate_patient_qr(uuid.uuid4(), "Test Patient")
    assert buffer is not None
    data = buffer.read()
    assert len(data) > 0
    assert data[:4] == b'\x89PNG'  # PNG header
