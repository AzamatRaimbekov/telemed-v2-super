def test_surgery_status_enum():
    from app.models.surgery_protocol import SurgeryStatus
    assert SurgeryStatus.PLANNED == "planned"
    assert SurgeryStatus.IN_PROGRESS == "in_progress"
    assert SurgeryStatus.COMPLETED == "completed"
    assert SurgeryStatus.CANCELLED == "cancelled"
