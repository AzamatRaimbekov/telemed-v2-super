"""Celery task to send reminders for overdue and upcoming staff tasks."""
from app.tasks.celery_app import celery_app
from datetime import date, timedelta
import asyncio


@celery_app.task(name="check_task_reminders")
def check_task_reminders():
    """Check for overdue and upcoming staff tasks, send notifications."""
    asyncio.run(_check_tasks())


async def _check_tasks():
    from app.core.database import async_session_factory
    from sqlalchemy import select, and_
    from app.models.staff_task import StaffTask, TaskStatus

    today = date.today()
    tomorrow = today + timedelta(days=1)

    async with async_session_factory() as db:
        # Find overdue tasks
        overdue = await db.execute(
            select(StaffTask).where(and_(
                StaffTask.due_date < today,
                StaffTask.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
                StaffTask.is_deleted == False,
            ))
        )
        overdue_tasks = overdue.scalars().all()

        # Find tasks due tomorrow
        upcoming = await db.execute(
            select(StaffTask).where(and_(
                StaffTask.due_date == tomorrow,
                StaffTask.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
                StaffTask.is_deleted == False,
            ))
        )
        upcoming_tasks = upcoming.scalars().all()

        # Send notifications via dispatcher
        for task in overdue_tasks:
            if task.assigned_to_id:
                try:
                    from app.services.ws_manager import ws_manager
                    await ws_manager.send_to_user(str(task.assigned_to_id), {
                        "type": "task_overdue",
                        "task_id": str(task.id),
                        "title": task.title,
                        "due_date": task.due_date.isoformat(),
                        "message": f"Просрочена задача: {task.title}",
                    })
                except Exception:
                    pass

        for task in upcoming_tasks:
            if task.assigned_to_id:
                try:
                    from app.services.ws_manager import ws_manager
                    await ws_manager.send_to_user(str(task.assigned_to_id), {
                        "type": "task_reminder",
                        "task_id": str(task.id),
                        "title": task.title,
                        "due_date": task.due_date.isoformat(),
                        "message": f"Завтра дедлайн: {task.title}",
                    })
                except Exception:
                    pass

        return {
            "overdue_count": len(overdue_tasks),
            "upcoming_count": len(upcoming_tasks),
        }
