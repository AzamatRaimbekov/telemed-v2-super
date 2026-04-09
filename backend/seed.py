import asyncio
import uuid
from datetime import datetime, timezone, date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine
from app.core.security import hash_password
from app.models import Base
from app.models.clinic import Clinic, SubscriptionPlan
from app.models.facility import Bed, BedStatus, Department, Room, RoomType
from app.models.patient import BloodType, Gender, Patient, PatientStatus, RegistrationSource
from app.models.medical import MedicalCard
from app.models.user import User, UserRole


async def seed():
    async with async_session_factory() as session:
        # Check if already seeded
        existing = await session.execute(select(Clinic).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        clinic_id = uuid.uuid4()
        clinic = Clinic(
            id=clinic_id, name="Бишкек Мед Центр", slug="bishkek-med",
            address="ул. Токтогула 123, Бишкек, Кыргызстан",
            phone="+996 312 123456", email="info@bishkek-med.kg",
            working_hours={"mon": ["08:00", "18:00"], "tue": ["08:00", "18:00"],
                          "wed": ["08:00", "18:00"], "thu": ["08:00", "18:00"],
                          "fri": ["08:00", "18:00"], "sat": ["09:00", "14:00"], "sun": None},
            subscription_plan=SubscriptionPlan.PRO, is_active=True, clinic_id=clinic_id,
        )
        session.add(clinic)

        # Super Admin
        super_admin = User(
            id=uuid.uuid4(), email="admin@medcore.kg",
            hashed_password=hash_password("Admin123!"),
            first_name="System", last_name="Admin",
            role=UserRole.SUPER_ADMIN, is_active=True, clinic_id=clinic_id,
        )
        session.add(super_admin)

        # Departments
        dept_therapy = Department(id=uuid.uuid4(), name="Терапия", code="THER", clinic_id=clinic_id)
        dept_neuro = Department(id=uuid.uuid4(), name="Неврология", code="NEUR", clinic_id=clinic_id)
        dept_emergency = Department(id=uuid.uuid4(), name="Скорая помощь", code="EMER", clinic_id=clinic_id)
        dept_pharmacy = Department(id=uuid.uuid4(), name="Аптека", code="PHAR", clinic_id=clinic_id)
        dept_lab = Department(id=uuid.uuid4(), name="Лаборатория", code="LAB", clinic_id=clinic_id)
        for dept in [dept_therapy, dept_neuro, dept_emergency, dept_pharmacy, dept_lab]:
            session.add(dept)

        # Staff
        doctor_therapist_id = uuid.uuid4()
        nurse_id = uuid.uuid4()
        staff_data = [
            (uuid.uuid4(), "clinic_admin@bishkek-med.kg", "Айгуль", "Маматова", UserRole.CLINIC_ADMIN, None, None),
            (doctor_therapist_id, "doctor.therapist@bishkek-med.kg", "Бакыт", "Исаков", UserRole.DOCTOR, "Терапевт", dept_therapy.id),
            (uuid.uuid4(), "doctor.neuro@bishkek-med.kg", "Нурлан", "Жумабеков", UserRole.DOCTOR, "Невролог", dept_neuro.id),
            (nurse_id, "nurse@bishkek-med.kg", "Гулзат", "Токтобаева", UserRole.NURSE, None, dept_therapy.id),
            (uuid.uuid4(), "reception@bishkek-med.kg", "Жаныл", "Асанова", UserRole.RECEPTIONIST, None, None),
            (uuid.uuid4(), "pharmacist@bishkek-med.kg", "Эрмек", "Кадыров", UserRole.PHARMACIST, None, dept_pharmacy.id),
            (uuid.uuid4(), "lab@bishkek-med.kg", "Азамат", "Турдубаев", UserRole.LAB_TECHNICIAN, None, dept_lab.id),
        ]
        for uid, email, first, last, role, spec, dept_id in staff_data:
            user = User(
                id=uid, email=email, hashed_password=hash_password("Staff123!"),
                first_name=first, last_name=last, role=role,
                specialization=spec, department_id=dept_id,
                is_active=True, clinic_id=clinic_id,
            )
            session.add(user)

        # Rooms and Beds
        room_therapy = Room(id=uuid.uuid4(), department_id=dept_therapy.id, name="Палата 101", room_number="101", room_type=RoomType.WARD, capacity=4, floor=1, clinic_id=clinic_id)
        room_neuro = Room(id=uuid.uuid4(), department_id=dept_neuro.id, name="Палата 201", room_number="201", room_type=RoomType.WARD, capacity=2, floor=2, clinic_id=clinic_id)
        room_consult = Room(id=uuid.uuid4(), department_id=dept_therapy.id, name="Кабинет 1", room_number="K1", room_type=RoomType.CONSULTATION, capacity=1, floor=1, clinic_id=clinic_id)
        for room in [room_therapy, room_neuro, room_consult]:
            session.add(room)

        for i in range(1, 5):
            session.add(Bed(id=uuid.uuid4(), room_id=room_therapy.id, bed_number=f"101-{i}", status=BedStatus.AVAILABLE, clinic_id=clinic_id))
        for i in range(1, 3):
            session.add(Bed(id=uuid.uuid4(), room_id=room_neuro.id, bed_number=f"201-{i}", status=BedStatus.AVAILABLE, clinic_id=clinic_id))

        # Patients
        patients_data = [
            ("Асан", "Уметов", "Бакирович", "1985-03-15", Gender.MALE, "AN1234567", "12345678901234"),
            ("Бермет", "Сыдыкова", "Канатовна", "1990-07-22", Gender.FEMALE, "AN2345678", "23456789012345"),
            ("Канат", "Жээнбеков", "Сагындыкович", "1978-11-01", Gender.MALE, "AN3456789", "34567890123456"),
            ("Динара", "Абдыкалыкова", "Нурлановна", "1995-05-10", Gender.FEMALE, "AN4567890", "45678901234567"),
            ("Эрмек", "Бообеков", "Талантович", "1960-01-30", Gender.MALE, "AN5678901", "56789012345678"),
        ]
        for i, (first, last, middle, dob, gender, passport, inn) in enumerate(patients_data):
            patient_id = uuid.uuid4()
            patient = Patient(
                id=patient_id, first_name=first, last_name=last, middle_name=middle,
                date_of_birth=date.fromisoformat(dob), gender=gender,
                passport_number=passport, inn=inn,
                address=f"г. Бишкек, ул. Примерная {i+1}",
                phone=f"+996 555 {100000 + i}",
                blood_type=BloodType.UNKNOWN,
                assigned_doctor_id=doctor_therapist_id, assigned_nurse_id=nurse_id,
                registration_source=RegistrationSource.WALK_IN,
                status=PatientStatus.ACTIVE, clinic_id=clinic_id,
            )
            session.add(patient)
            medical_card = MedicalCard(
                id=uuid.uuid4(), patient_id=patient_id,
                card_number=f"MC-bishkek-med-{1000 + i}",
                opened_at=datetime.now(timezone.utc), clinic_id=clinic_id,
            )
            session.add(medical_card)

        await session.commit()
        print("Seed completed successfully!")
        print("Login credentials:")
        print("  Super Admin: admin@medcore.kg / Admin123!")
        print("  Clinic Admin: clinic_admin@bishkek-med.kg / Staff123!")
        print("  Doctor: doctor.therapist@bishkek-med.kg / Staff123!")
        print("  Receptionist: reception@bishkek-med.kg / Staff123!")

if __name__ == "__main__":
    asyncio.run(seed())
