from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.models.telemedicine import TelemedicineSession, TelemedicineSessionStatus, Message

router = APIRouter(prefix="/telemedicine", tags=["Telemedicine"])


@router.get("/sessions")
async def list_sessions(
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = None,
    patient_id: uuid.UUID | None = None,
):
    query = (
        select(TelemedicineSession)
        .where(
            TelemedicineSession.clinic_id == current_user.clinic_id,
            TelemedicineSession.is_deleted == False,
        )
        .order_by(desc(TelemedicineSession.created_at))
    )
    if current_user.role.value == "DOCTOR":
        query = query.where(TelemedicineSession.doctor_id == current_user.id)
    if status:
        query = query.where(TelemedicineSession.status == TelemedicineSessionStatus(status))
    if patient_id:
        query = query.where(TelemedicineSession.patient_id == patient_id)
    result = await session.execute(query)
    return [_session_to_dict(s) for s in result.scalars().all()]


@router.post("/sessions", status_code=201)
async def create_session(
    session: DBSession,
    current_user: CurrentUser,
    patient_id: uuid.UUID = Query(...),
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR),
):
    room_id = f"room-{uuid.uuid4().hex[:12]}"
    ts = TelemedicineSession(
        id=uuid.uuid4(),
        patient_id=patient_id,
        doctor_id=current_user.id,
        clinic_id=current_user.clinic_id,
        room_id=room_id,
        status=TelemedicineSessionStatus.WAITING,
    )
    session.add(ts)
    await session.flush()
    await session.refresh(ts)
    await session.commit()
    return _session_to_dict(ts)


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    query = select(TelemedicineSession).where(
        TelemedicineSession.id == session_id,
        TelemedicineSession.clinic_id == current_user.clinic_id,
        TelemedicineSession.is_deleted == False,
    )
    result = await session.execute(query)
    ts = result.scalar_one_or_none()
    if not ts:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("TelemedicineSession", str(session_id))
    return _session_to_dict(ts)


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    status: str | None = None,
    doctor_notes: str | None = None,
):
    query = select(TelemedicineSession).where(
        TelemedicineSession.id == session_id,
        TelemedicineSession.clinic_id == current_user.clinic_id,
        TelemedicineSession.is_deleted == False,
    )
    result = await session.execute(query)
    ts = result.scalar_one_or_none()
    if not ts:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("TelemedicineSession", str(session_id))

    now = datetime.now(timezone.utc)
    if status:
        ts.status = TelemedicineSessionStatus(status)
        if status == "ACTIVE" and not ts.started_at:
            ts.started_at = now
        elif status in ("COMPLETED", "CANCELLED"):
            ts.ended_at = now
            if ts.started_at:
                ts.duration_seconds = int((now - ts.started_at).total_seconds())
    if doctor_notes is not None:
        ts.doctor_notes = doctor_notes

    await session.flush()
    await session.refresh(ts)
    await session.commit()
    return _session_to_dict(ts)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    query = select(TelemedicineSession).where(
        TelemedicineSession.id == session_id,
        TelemedicineSession.clinic_id == current_user.clinic_id,
        TelemedicineSession.is_deleted == False,
    )
    result = await session.execute(query)
    ts = result.scalar_one_or_none()
    if not ts:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("TelemedicineSession", str(session_id))
    ts.is_deleted = True
    await session.commit()


# ── Chat messages ──────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/messages")
async def list_messages(
    session_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    ts_q = select(TelemedicineSession.patient_id).where(
        TelemedicineSession.id == session_id,
        TelemedicineSession.clinic_id == current_user.clinic_id,
    )
    ts_result = await session.execute(ts_q)
    patient_id = ts_result.scalar_one_or_none()
    if patient_id is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("TelemedicineSession", str(session_id))

    query = (
        select(Message)
        .where(
            Message.patient_id == patient_id,
            Message.is_deleted == False,
        )
        .order_by(Message.created_at)
    )
    result = await session.execute(query)
    return [
        {
            "id": str(m.id),
            "sender_id": str(m.sender_id),
            "content": m.content,
            "is_read": m.is_read,
            "created_at": m.created_at,
        }
        for m in result.scalars().all()
    ]


@router.post("/sessions/{session_id}/messages", status_code=201)
async def send_message(
    session_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
    content: str = Query(...),
):
    ts_q = select(TelemedicineSession).where(
        TelemedicineSession.id == session_id,
        TelemedicineSession.clinic_id == current_user.clinic_id,
    )
    ts_result = await session.execute(ts_q)
    ts = ts_result.scalar_one_or_none()
    if not ts:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("TelemedicineSession", str(session_id))

    recipient_id = ts.patient_id if current_user.id == ts.doctor_id else ts.doctor_id

    msg = Message(
        id=uuid.uuid4(),
        sender_id=current_user.id,
        recipient_id=recipient_id,
        patient_id=ts.patient_id,
        content=content,
        clinic_id=current_user.clinic_id,
    )
    session.add(msg)
    await session.flush()
    await session.refresh(msg)
    await session.commit()
    return {"id": str(msg.id), "content": msg.content, "created_at": msg.created_at}


def _session_to_dict(s: TelemedicineSession) -> dict:
    patient_name = ""
    if s.patient:
        patient_name = f"{s.patient.last_name} {s.patient.first_name}"
    doctor_name = ""
    if s.doctor:
        doctor_name = f"{s.doctor.last_name} {s.doctor.first_name}"
    return {
        "id": str(s.id),
        "patient_id": str(s.patient_id),
        "patient_name": patient_name,
        "doctor_id": str(s.doctor_id),
        "doctor_name": doctor_name,
        "room_id": s.room_id,
        "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "duration_seconds": s.duration_seconds,
        "doctor_notes": s.doctor_notes,
        "created_at": s.created_at,
    }
