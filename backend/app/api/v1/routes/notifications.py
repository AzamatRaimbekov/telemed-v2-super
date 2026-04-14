from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Query
from sqlalchemy import select, desc, func, update
from app.api.deps import CurrentUser, DBSession
from app.models.notification import Notification, NotificationType, NotificationSeverity

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/unread-count")
async def get_unread_count(
    session: DBSession,
    current_user: CurrentUser,
):
    """Returns count of unread notifications for the current user."""
    q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    )
    result = await session.execute(q)
    count = result.scalar_one()
    return {"count": count}


@router.get("")
async def list_notifications(
    session: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List notifications for current user — unread first, then by date."""
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.is_read.asc(), desc(Notification.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(q)
    items = list(result.scalars().all())

    total_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id
    )
    total_result = await session.execute(total_q)
    total = total_result.scalar_one()

    return {
        "items": [
            {
                "id": str(n.id),
                "type": n.type.value,
                "title": n.title,
                "message": n.message,
                "severity": n.severity.value,
                "is_read": n.is_read,
                "read_at": n.read_at,
                "reference_type": n.reference_type,
                "reference_id": str(n.reference_id) if n.reference_id else None,
                "data": n.data,
                "created_at": n.created_at,
            }
            for n in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark a single notification as read."""
    q = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    )
    result = await session.execute(q)
    notification = result.scalar_one_or_none()
    if notification is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await session.commit()

    return {"id": str(notification.id), "is_read": notification.is_read}


@router.post("/read-all")
async def mark_all_read(
    session: DBSession,
    current_user: CurrentUser,
):
    """Mark all unread notifications as read for the current user."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_at=now)
    )
    await session.execute(stmt)
    await session.commit()
    return {"success": True}


@router.post("")
async def create_notification(
    session: DBSession,
    current_user: CurrentUser,
    body: dict,
):
    """Create a notification (admin/system use)."""
    notification = Notification(
        user_id=uuid.UUID(body["user_id"]) if isinstance(body.get("user_id"), str) else body.get("user_id", current_user.id),
        clinic_id=current_user.clinic_id,
        type=NotificationType(body.get("type", NotificationType.SYSTEM)),
        title=body["title"],
        message=body["message"],
        severity=NotificationSeverity(body.get("severity", NotificationSeverity.INFO)),
        reference_type=body.get("reference_type"),
        reference_id=uuid.UUID(body["reference_id"]) if body.get("reference_id") else None,
        data=body.get("data"),
    )
    session.add(notification)
    await session.commit()
    await session.refresh(notification)
    return {"id": str(notification.id), "title": notification.title, "created_at": notification.created_at}
