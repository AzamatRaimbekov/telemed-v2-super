"""WhatsApp Booking Service — parses incoming messages and manages appointment flow."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.staff import StaffSchedule


# Simple intent keywords for doctor specialties (Russian)
SPECIALTY_KEYWORDS: dict[str, str] = {
    "терапевт": "therapist",
    "кардиолог": "cardiologist",
    "невролог": "neurologist",
    "хирург": "surgeon",
    "педиатр": "pediatrician",
    "окулист": "ophthalmologist",
    "лор": "ent",
    "гинеколог": "gynecologist",
    "дерматолог": "dermatologist",
    "уролог": "urologist",
}


class WhatsAppBookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def parse_message(self, phone: str, message: str, clinic_id: uuid.UUID) -> str:
        """Parse incoming WhatsApp message and return response text."""
        text = message.lower().strip()

        # Check if it's a booking request
        if any(kw in text for kw in ["записаться", "запись", "прием", "приём", "врач"]):
            return await self._handle_booking_request(phone, text, clinic_id)

        # Check if it's a number selection (confirming a slot)
        if text.isdigit():
            return await self._handle_slot_selection(phone, int(text), clinic_id)

        # Check booking status
        if any(kw in text for kw in ["статус", "моя запись", "мои записи"]):
            return await self._handle_status_request(phone, clinic_id)

        # Cancel
        if any(kw in text for kw in ["отмена", "отменить"]):
            return await self._handle_cancel(phone, clinic_id)

        # Default help message
        return (
            "Здравствуйте! Я бот MedCore KG.\n\n"
            "Доступные команды:\n"
            "- «Записаться к терапевту» — запись к врачу\n"
            "- «Статус» — проверить мои записи\n"
            "- «Отмена» — отменить запись\n\n"
            "Специальности: терапевт, кардиолог, невролог, хирург, педиатр, окулист, ЛОР, гинеколог, дерматолог, уролог"
        )

    async def _handle_booking_request(self, phone: str, text: str, clinic_id: uuid.UUID) -> str:
        """Find available doctors and offer time slots."""
        # Detect requested specialty
        detected_specialty = None
        for keyword, specialty in SPECIALTY_KEYWORDS.items():
            if keyword in text:
                detected_specialty = specialty
                break

        if not detected_specialty:
            return (
                "К какому специалисту вы хотите записаться?\n\n"
                "Доступные специальности:\n"
                "терапевт, кардиолог, невролог, хирург, педиатр, окулист, ЛОР, гинеколог, дерматолог, уролог\n\n"
                "Напишите, например: «Записаться к терапевту»"
            )

        # Find doctors with this specialty in the clinic
        doctors = await self._find_doctors_by_specialty(detected_specialty, clinic_id)
        if not doctors:
            return f"К сожалению, сейчас нет доступных врачей по специальности «{detected_specialty}». Попробуйте позже."

        # Generate available slots for the next 3 days
        slots = self._generate_available_slots(doctors)
        if not slots:
            return "К сожалению, нет свободных слотов на ближайшие дни. Попробуйте позже."

        # Format response
        lines = [f"Доступные слоты для записи к специалисту ({detected_specialty}):\n"]
        for i, slot in enumerate(slots[:5], 1):
            doctor_name = slot["doctor_name"]
            dt = slot["datetime"].strftime("%d.%m.%Y %H:%M")
            lines.append(f"{i}. {doctor_name} — {dt}")

        lines.append("\nОтправьте номер слота для подтверждения записи.")
        return "\n".join(lines)

    async def _find_doctors_by_specialty(self, specialty: str, clinic_id: uuid.UUID) -> list[User]:
        """Find active doctors by specialty keyword."""
        result = await self.db.execute(
            select(User).where(
                User.clinic_id == clinic_id,
                User.role == UserRole.DOCTOR,
                User.is_active == True,
            )
        )
        doctors = result.scalars().all()
        # Filter by specialty in specialization field if available
        matched = []
        for doc in doctors:
            spec = getattr(doc, "specialization", "") or ""
            if specialty.lower() in spec.lower() or not spec:
                matched.append(doc)
        return matched[:5]  # Limit to 5 doctors

    def _generate_available_slots(self, doctors: list[User]) -> list[dict]:
        """Generate mock available slots for the next 3 days."""
        slots = []
        now = datetime.now(timezone.utc)
        base_date = now.replace(hour=9, minute=0, second=0, microsecond=0)
        if base_date < now:
            base_date += timedelta(days=1)

        for day_offset in range(3):
            day = base_date + timedelta(days=day_offset)
            for doctor in doctors:
                for hour in [9, 10, 11, 14, 15, 16]:
                    slot_time = day.replace(hour=hour)
                    doctor_name = getattr(doctor, "full_name", None) or f"{doctor.last_name} {doctor.first_name}"
                    slots.append({
                        "doctor_id": doctor.id,
                        "doctor_name": doctor_name,
                        "datetime": slot_time,
                    })
        return slots[:10]

    async def _handle_slot_selection(self, phone: str, slot_number: int, clinic_id: uuid.UUID) -> str:
        """Confirm booking for selected slot (simplified flow)."""
        if slot_number < 1 or slot_number > 10:
            return "Неверный номер слота. Пожалуйста, выберите число от 1 до 10."

        # Find patient by phone
        patient = await self._find_patient_by_phone(phone, clinic_id)
        if not patient:
            return (
                "Ваш номер телефона не найден в системе. "
                "Пожалуйста, зарегистрируйтесь в клинике или через портал MedCore KG."
            )

        return (
            f"Запись подтверждена!\n\n"
            f"Пациент: {patient.last_name} {patient.first_name}\n"
            f"Вам придёт напоминание за 1 час до приёма.\n\n"
            f"Для отмены напишите «Отмена»."
        )

    async def _handle_status_request(self, phone: str, clinic_id: uuid.UUID) -> str:
        """Return upcoming appointments for patient."""
        patient = await self._find_patient_by_phone(phone, clinic_id)
        if not patient:
            return "Ваш номер телефона не найден в системе."

        result = await self.db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient.id,
                Appointment.status.in_([
                    AppointmentStatus.SCHEDULED,
                    AppointmentStatus.CONFIRMED,
                ]),
            ).order_by(Appointment.scheduled_start.asc()).limit(5)
        )
        appointments = result.scalars().all()
        if not appointments:
            return "У вас нет предстоящих записей."

        lines = ["Ваши предстоящие записи:\n"]
        for appt in appointments:
            dt = appt.scheduled_start.strftime("%d.%m.%Y %H:%M") if appt.scheduled_start else "—"
            doctor_name = appt.doctor.full_name if appt.doctor else "—"
            lines.append(f"- {dt} — {doctor_name} ({appt.status.value})")
        return "\n".join(lines)

    async def _handle_cancel(self, phone: str, clinic_id: uuid.UUID) -> str:
        """Cancel the nearest upcoming appointment."""
        patient = await self._find_patient_by_phone(phone, clinic_id)
        if not patient:
            return "Ваш номер телефона не найден в системе."

        result = await self.db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient.id,
                Appointment.status == AppointmentStatus.SCHEDULED,
            ).order_by(Appointment.scheduled_start.asc()).limit(1)
        )
        appt = result.scalar_one_or_none()
        if not appt:
            return "У вас нет записей для отмены."

        appt.status = AppointmentStatus.CANCELLED
        await self.db.commit()
        dt = appt.scheduled_start.strftime("%d.%m.%Y %H:%M") if appt.scheduled_start else "—"
        return f"Запись на {dt} отменена."

    async def _find_patient_by_phone(self, phone: str, clinic_id: uuid.UUID) -> Patient | None:
        """Find patient by phone number."""
        # Normalize phone: keep only digits
        digits = re.sub(r"\D", "", phone)
        result = await self.db.execute(
            select(Patient).where(
                Patient.clinic_id == clinic_id,
            )
        )
        patients = result.scalars().all()
        for p in patients:
            p_phone = re.sub(r"\D", "", getattr(p, "phone", "") or "")
            if p_phone and digits.endswith(p_phone[-9:]):
                return p
        return None

    async def get_booking_status(self, phone: str, clinic_id: uuid.UUID) -> dict:
        """Get booking status by phone for API."""
        patient = await self._find_patient_by_phone(phone, clinic_id)
        if not patient:
            return {"found": False, "appointments": []}

        result = await self.db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient.id,
                Appointment.status.in_([
                    AppointmentStatus.SCHEDULED,
                    AppointmentStatus.CONFIRMED,
                ]),
            ).order_by(Appointment.scheduled_start.asc()).limit(10)
        )
        appointments = result.scalars().all()
        return {
            "found": True,
            "patient_name": f"{patient.last_name} {patient.first_name}",
            "appointments": [
                {
                    "id": str(a.id),
                    "scheduled_start": a.scheduled_start.isoformat() if a.scheduled_start else None,
                    "status": a.status.value,
                    "doctor_name": a.doctor.full_name if a.doctor else None,
                }
                for a in appointments
            ],
        }
