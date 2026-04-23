"""Test all model imports and table names."""

def test_all_models_import():
    from app.models import (
        Patient, User, Clinic, Appointment, Visit, MedicalCard,
        QueueEntry, NotificationLog, DocumentTemplate, FiscalReceipt,
        PatientWristband, VisitSummary, Prediction, DoctorRating,
        FamilyLink, MedicationReminder, LoyaltyAccount, PointsTransaction,
        StaffTask, StaffMessage, PatientChangelog, DocumentSignature,
        DoctorReferral, SurgeryProtocol, NurseDiaryEntry, InfectionRecord,
        TreatmentTemplate,
    )
    # Verify table names
    assert Patient.__tablename__ == "patients"
    assert QueueEntry.__tablename__ == "queue_entries"
    assert PatientWristband.__tablename__ == "patient_wristbands"
    assert StaffTask.__tablename__ == "staff_tasks"
    assert DoctorReferral.__tablename__ == "doctor_referrals"
    assert SurgeryProtocol.__tablename__ == "surgery_protocols"
