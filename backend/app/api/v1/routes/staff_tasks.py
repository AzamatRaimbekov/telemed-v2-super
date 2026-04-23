from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.staff_task import StaffTask, TaskStatus, TaskPriority
from app.models.user import User

router = APIRouter(prefix="/tasks", tags=["Staff Tasks"])


# ---------- schemas ----------

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assigned_to_id: uuid.UUID | None = None
    due_date: date | None = None


class TaskMove(BaseModel):
    status: TaskStatus
    sort_order: int = 0


def _task_to_dict(task: StaffTask, assignee_name: str | None = None) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "status": task.status.value if isinstance(task.status, TaskStatus) else task.status,
        "priority": task.priority.value if isinstance(task.priority, TaskPriority) else task.priority,
        "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        "assignee_name": assignee_name,
        "created_by_id": str(task.created_by_id),
        "patient_id": str(task.patient_id) if task.patient_id else None,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "sort_order": task.sort_order,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }


async def _enrich_tasks(session: AsyncSession, tasks: list[StaffTask]) -> list[dict]:
    assignee_ids = {t.assigned_to_id for t in tasks if t.assigned_to_id}
    names: dict[uuid.UUID, str] = {}
    if assignee_ids:
        result = await session.execute(
            select(User.id, User.first_name, User.last_name).where(User.id.in_(assignee_ids))
        )
        for uid, fn, ln in result.all():
            names[uid] = f"{fn} {ln}"
    return [_task_to_dict(t, names.get(t.assigned_to_id) if t.assigned_to_id else None) for t in tasks]


# ---------- endpoints ----------

@router.get("/board")
async def task_board(
    session: DBSession,
    current_user: CurrentUser,
    assigned_to_id: uuid.UUID | None = Query(None),
):
    """Get kanban board grouped by status."""
    q = select(StaffTask).where(
        StaffTask.clinic_id == current_user.clinic_id,
        StaffTask.is_deleted == False,
    ).order_by(StaffTask.sort_order, StaffTask.created_at.desc())

    if assigned_to_id:
        q = q.where(StaffTask.assigned_to_id == assigned_to_id)

    result = await session.execute(q)
    tasks = list(result.scalars().all())
    enriched = await _enrich_tasks(session, tasks)

    board: dict[str, list] = {s.value: [] for s in TaskStatus}
    for t in enriched:
        board[t["status"]].append(t)
    return board


@router.get("/")
async def list_tasks(
    session: DBSession,
    current_user: CurrentUser,
    status: TaskStatus | None = Query(None),
    priority: TaskPriority | None = Query(None),
    assigned_to_id: uuid.UUID | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    q = select(StaffTask).where(
        StaffTask.clinic_id == current_user.clinic_id,
        StaffTask.is_deleted == False,
    ).order_by(StaffTask.sort_order, StaffTask.created_at.desc()).limit(limit)

    if status:
        q = q.where(StaffTask.status == status)
    if priority:
        q = q.where(StaffTask.priority == priority)
    if assigned_to_id:
        q = q.where(StaffTask.assigned_to_id == assigned_to_id)

    result = await session.execute(q)
    tasks = list(result.scalars().all())
    return await _enrich_tasks(session, tasks)


@router.post("/", status_code=201)
async def create_task(
    data: TaskCreate,
    session: DBSession,
    current_user: CurrentUser,
):
    task = StaffTask(
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        assigned_to_id=data.assigned_to_id,
        created_by_id=current_user.id,
        patient_id=data.patient_id,
        due_date=data.due_date,
        clinic_id=current_user.clinic_id,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return _task_to_dict(task)


@router.patch("/{task_id}")
async def update_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(StaffTask).where(
            StaffTask.id == task_id,
            StaffTask.clinic_id == current_user.clinic_id,
            StaffTask.is_deleted == False,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("StaffTask")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(task, key, val)

    await session.commit()
    await session.refresh(task)
    return _task_to_dict(task)


@router.patch("/{task_id}/move")
async def move_task(
    task_id: uuid.UUID,
    data: TaskMove,
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(StaffTask).where(
            StaffTask.id == task_id,
            StaffTask.clinic_id == current_user.clinic_id,
            StaffTask.is_deleted == False,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("StaffTask")

    task.status = data.status
    task.sort_order = data.sort_order
    await session.commit()
    await session.refresh(task)
    return _task_to_dict(task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(StaffTask).where(
            StaffTask.id == task_id,
            StaffTask.clinic_id == current_user.clinic_id,
            StaffTask.is_deleted == False,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("StaffTask")

    task.is_deleted = True
    await session.commit()
    return {"ok": True}
