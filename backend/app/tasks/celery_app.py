from celery import Celery
from app.core.config import settings

celery_app = Celery("medcore", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="Asia/Bishkek", enable_utc=True, task_track_started=True, task_acks_late=True, worker_prefetch_multiplier=1)
celery_app.conf.beat_schedule = {
    "check-appointment-reminders": {
        "task": "check_appointment_reminders",
        "schedule": 900.0,  # every 15 minutes
    },
    "check-task-reminders": {
        "task": "check_task_reminders",
        "schedule": 3600.0,  # every hour
    },
}
celery_app.autodiscover_tasks(["app.tasks.notification_tasks", "app.tasks.task_reminders"])
