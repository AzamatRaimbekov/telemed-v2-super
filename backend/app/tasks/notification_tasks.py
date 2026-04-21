from app.tasks.celery_app import celery_app
from datetime import datetime, timedelta, timezone


@celery_app.task(name="check_appointment_reminders")
def check_appointment_reminders():
    """Check for upcoming appointments and send reminders.

    Called by Celery Beat every 15 minutes.
    Finds appointments in the next 2 hours that haven't been reminded yet,
    and sends SMS/WhatsApp/Telegram notifications to the patient.
    """
    import asyncio

    asyncio.run(_check_reminders())


async def _check_reminders():
    from sqlalchemy import select, and_
    from sqlalchemy.orm import selectinload

    from app.core.database import async_session_factory
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.notification_log import NotificationChannel, NotificationLog
    from app.models.patient import Patient
    from app.services.notification_dispatcher import NotificationDispatcher

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        window = now + timedelta(hours=2)

        # Find upcoming confirmed/scheduled appointments in next 2 hours
        stmt = (
            select(Appointment)
            .options(selectinload(Appointment.patient))
            .where(
                and_(
                    Appointment.scheduled_start >= now,
                    Appointment.scheduled_start <= window,
                    Appointment.status.in_([
                        AppointmentStatus.SCHEDULED,
                        AppointmentStatus.CONFIRMED,
                    ]),
                    Appointment.is_deleted == False,  # noqa: E712
                )
            )
        )
        result = await db.execute(stmt)
        appointments = list(result.scalars().all())

        dispatcher = NotificationDispatcher(db)

        for appt in appointments:
            patient = appt.patient
            if not patient or not patient.phone:
                continue

            # Check if reminder already sent for this appointment
            existing = await db.execute(
                select(NotificationLog).where(
                    and_(
                        NotificationLog.related_type == "appointment",
                        NotificationLog.related_id == appt.id,
                        NotificationLog.channel == NotificationChannel.SMS,
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Format reminder message
            start_local = appt.scheduled_start
            time_str = start_local.strftime("%H:%M") if start_local else "—"
            message = (
                f"MedCore KG: Напоминаем о приёме {time_str}. "
                f"Пожалуйста, приходите за 10 минут до начала."
            )

            await dispatcher.send(
                channel=NotificationChannel.SMS,
                recipient=patient.phone,
                body=message,
                clinic_id=appt.clinic_id,
                related_type="appointment",
                related_id=appt.id,
            )
