def test_prediction_type_enum():
    from app.models.prediction import PredictionType
    assert PredictionType.BED_OCCUPANCY == "bed_occupancy"
    assert PredictionType.MEDICATION_CONSUMPTION == "medication_consumption"
    assert PredictionType.PATIENT_ADMISSIONS == "patient_admissions"
