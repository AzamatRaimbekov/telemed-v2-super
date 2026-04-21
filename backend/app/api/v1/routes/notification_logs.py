from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import select, func, desc, and_

from app.api.deps import CurrentUser, DBSession
from app.models.notification_log import NotificationChannel, NotificationLog, NotificationStatus
from app.models.user import UserRole
from app.services.notification_dispatcher import NotificationDispatcher

router = APIRouter(prefix="/notification-logs", tags=["Notification Logs"])


@router.get("")
async def list_notification_logs(
    session: DBSession,
    current_user: CurrentUser,
    channel: str | None = Query(None, description="Filter by channel: SMS, WHATSAPP, TELEGRAM, EMAIL, IN_APP"),
    status: str | None = Query(None, description="Filter by status: PENDING, SENT, DELIVERED, FAILED"),
    date_from: datetime | None = Query(None, description="Filter from date (ISO 8601)"),
    date_to: datetime | None = Query(None, description="Filter to date (ISO 8601)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List outbound notification logs with optional filters."""
    conditions = [NotificationLog.clinic_id == current_user.clinic_id]

    if channel:
        conditions.append(NotificationLog.channel == NotificationChannel(channel))
    if status:
        conditions.append(NotificationLog.status == NotificationStatus(status))
    if date_from:
        conditions.append(NotificationLog.created_at >= date_from)
    if date_to:
        conditions.append(NotificationLog.created_at <= date_to)

    q = (
        select(NotificationLog)
        .where(and_(*conditions))
        .order_by(desc(NotificationLog.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(q)
    items = list(result.scalars().all())

    total_q = select(func.count()).select_from(NotificationLog).where(and_(*conditions))
    total_result = await session.execute(total_q)
    total = total_result.scalar_one()

    return {
        "items": [
            {
                "id": str(n.id),
                "channel": n.channel.value,
                "recipient": n.recipient,
                "subject": n.subject,
                "body": n.body[:200] if n.body else None,
                "status": n.status.value,
                "error_message": n.error_message,
                "related_type": n.related_type,
                "related_id": str(n.related_id) if n.related_id else None,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/send")
async def send_notification(
    session: DBSession,
    current_user: CurrentUser,
    body: dict,
):
    """Manually send a notification (admin only)."""
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Only admins can send manual notifications")

    dispatcher = NotificationDispatcher(session)
    log = await dispatcher.send(
        channel=NotificationChannel(body["channel"]),
        recipient=body["recipient"],
        body=body["body"],
        subject=body.get("subject"),
        clinic_id=current_user.clinic_id,
        related_type=body.get("related_type"),
        related_id=uuid.UUID(body["related_id"]) if body.get("related_id") else None,
    )
    return {
        "id": str(log.id),
        "channel": log.channel.value,
        "status": log.status.value,
        "error_message": log.error_message,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
    }


@router.get("/stats")
async def notification_stats(
    session: DBSession,
    current_user: CurrentUser,
):
    """Get notification stats grouped by channel and status."""
    q = (
        select(
            NotificationLog.channel,
            NotificationLog.status,
            func.count().label("count"),
        )
        .where(NotificationLog.clinic_id == current_user.clinic_id)
        .group_by(NotificationLog.channel, NotificationLog.status)
    )
    result = await session.execute(q)
    rows = result.all()

    stats: dict = {}
    for channel, status, count in rows:
        ch = channel.value
        if ch not in stats:
            stats[ch] = {"sent": 0, "failed": 0, "pending": 0, "delivered": 0, "total": 0}
        stats[ch][status.value.lower()] = count
        stats[ch]["total"] += count

    return {"stats": stats}
