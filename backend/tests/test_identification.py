import pytest
from app.services.patient_identification import PatientIdentificationService, IdentificationMethod

def test_identification_methods():
    assert IdentificationMethod.WRISTBAND_UID == "wristband_uid"
    assert IdentificationMethod.QR_CODE == "qr_code"
    assert IdentificationMethod.PATIENT_ID == "patient_id"
    assert IdentificationMethod.INN == "inn"
    assert IdentificationMethod.PHONE == "phone"
