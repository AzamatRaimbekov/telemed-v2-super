from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.models.staff_message import StaffMessage
from app.models.user import User

router = APIRouter(prefix="/chat", tags=["Staff Chat"])


# ---------- schemas ----------

class SendMessage(BaseModel):
    channel: str = "general"
    body: str
    recipient_id: uuid.UUID | None = None


def _msg_to_dict(msg: StaffMessage, sender_name: str | None = None) -> dict:
    return {
        "id": str(msg.id),
        "sender_id": str(msg.sender_id),
        "sender_name": sender_name,
        "recipient_id": str(msg.recipient_id) if msg.recipient_id else None,
        "channel": msg.channel,
        "body": msg.body,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
    }


# ---------- endpoints ----------

@router.get("/channels")
async def list_channels(
    session: DBSession,
    current_user: CurrentUser,
):
    """List available channels including DMs."""
    static_channels = [
        {"id": "general", "name": "Общий", "type": "group"},
        {"id": "doctors", "name": "Врачи", "type": "group"},
        {"id": "nurses", "name": "Медсёстры", "type": "group"},
    ]

    # Find DM channels for this user
    uid = str(current_user.id)
    result = await session.execute(
        select(StaffMessage.channel).where(
            StaffMessage.clinic_id == current_user.clinic_id,
            StaffMessage.is_deleted == False,
            StaffMessage.channel.like("dm:%"),
            or_(
                StaffMessage.sender_id == current_user.id,
                StaffMessage.recipient_id == current_user.id,
            ),
        ).distinct()
    )
    dm_channels = [r[0] for r in result.all()]

    # Resolve other user names for DMs
    dm_list = []
    for ch in dm_channels:
        parts = ch.split(":")
        if len(parts) == 3:
            other_id = parts[1] if parts[2] == uid else parts[2]
            try:
                other_uuid = uuid.UUID(other_id)
                user_result = await session.execute(
                    select(User.first_name, User.last_name).where(User.id == other_uuid)
                )
                row = user_result.first()
                name = f"{row[0]} {row[1]}" if row else "Unknown"
            except (ValueError, IndexError):
                name = "Unknown"
            dm_list.append({"id": ch, "name": name, "type": "dm"})

    return static_channels + dm_list


@router.get("/messages")
async def get_messages(
    session: DBSession,
    current_user: CurrentUser,
    channel: str = Query("general"),
    limit: int = Query(50, ge=1, le=200),
    before: uuid.UUID | None = Query(None),
):
    """Get messages for a channel."""
    q = select(StaffMessage).where(
        StaffMessage.clinic_id == current_user.clinic_id,
        StaffMessage.channel == channel,
        StaffMessage.is_deleted == False,
    ).order_by(StaffMessage.created_at.desc()).limit(limit)

    if before:
        # Get the created_at of the 'before' message for cursor pagination
        before_result = await session.execute(
            select(StaffMessage.created_at).where(StaffMessage.id == before)
        )
        before_row = before_result.first()
        if before_row:
            q = q.where(StaffMessage.created_at < before_row[0])

    result = await session.execute(q)
    messages = list(result.scalars().all())

    # Resolve sender names
    sender_ids = {m.sender_id for m in messages}
    names: dict[uuid.UUID, str] = {}
    if sender_ids:
        name_result = await session.execute(
            select(User.id, User.first_name, User.last_name).where(User.id.in_(sender_ids))
        )
        for uid, fn, ln in name_result.all():
            names[uid] = f"{fn} {ln}"

    items = [_msg_to_dict(m, names.get(m.sender_id)) for m in messages]
    items.reverse()  # chronological order
    return items


@router.post("/messages", status_code=201)
async def send_message(
    data: SendMessage,
    session: DBSession,
    current_user: CurrentUser,
):
    """Send a message to a channel."""
    channel = data.channel
    recipient_id = data.recipient_id

    # Auto-construct DM channel id
    if recipient_id and not channel.startswith("dm:"):
        ids = sorted([str(current_user.id), str(recipient_id)])
        channel = f"dm:{ids[0]}:{ids[1]}"

    msg = StaffMessage(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        channel=channel,
        body=data.body,
        clinic_id=current_user.clinic_id,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    sender_name = f"{current_user.first_name} {current_user.last_name}"
    return _msg_to_dict(msg, sender_name)


@router.patch("/messages/{message_id}/read")
async def mark_as_read(
    message_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    result = await session.execute(
        select(StaffMessage).where(
            StaffMessage.id == message_id,
            StaffMessage.clinic_id == current_user.clinic_id,
            StaffMessage.is_deleted == False,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("StaffMessage")

    msg.is_read = True
    await session.commit()
    return {"ok": True}


@router.get("/unread-count")
async def unread_count(
    session: DBSession,
    current_user: CurrentUser,
):
    """Total unread messages across all channels for this user."""
    result = await session.execute(
        select(func.count(StaffMessage.id)).where(
            StaffMessage.clinic_id == current_user.clinic_id,
            StaffMessage.is_deleted == False,
            StaffMessage.is_read == False,
            StaffMessage.sender_id != current_user.id,
            or_(
                StaffMessage.recipient_id == current_user.id,
                StaffMessage.recipient_id == None,
            ),
        )
    )
    count = result.scalar() or 0
    return {"count": count}
