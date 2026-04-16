from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.core.database import async_session_factory
from app.core.security import decode_token
from app.models.user import User
from app.schemas.monitoring import (
    CameraCreate, CameraUpdate, CameraOut,
    SensorCreate, SensorUpdate,
)
from app.services.monitoring import MonitoringService

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


# ── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, list[WebSocket]] = {}  # patient_id -> [ws, ...]

    async def connect(self, patient_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(patient_id, []).append(websocket)

    def disconnect(self, patient_id: str, websocket: WebSocket) -> None:
        conns = self.active.get(patient_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, patient_id: str, data: dict) -> None:
        for ws in self.active.get(patient_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


# ── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/{patient_id}/ws")
async def monitoring_ws(websocket: WebSocket, patient_id: uuid.UUID):
    """Real-time monitoring WebSocket. Auth via query param ?token=..."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    pid = str(patient_id)
    await manager.connect(pid, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "acknowledge_alert":
                async with async_session_factory() as session:
                    service = MonitoringService(session)
                    user_id = uuid.UUID(payload["sub"])
                    clinic_id = uuid.UUID(payload["clinic_id"])
                    alert = await service.acknowledge_alert(
                        uuid.UUID(data["alert_id"]), clinic_id, user_id,
                    )
                    await session.commit()
                    await manager.broadcast(pid, {
                        "type": "alert_update",
                        "alert_id": str(alert.id),
                        "status": alert.status.value,
                    })

            elif msg_type == "update_nurse_call":
                async with async_session_factory() as session:
                    service = MonitoringService(session)
                    user_id = uuid.UUID(payload["sub"])
                    clinic_id = uuid.UUID(payload["clinic_id"])
                    call = await service.update_nurse_call_status(
                        uuid.UUID(data["call_id"]), clinic_id, data["status"], user_id,
                    )
                    await session.commit()
                    await manager.broadcast(pid, {
                        "type": "nurse_call_update",
                        "call": _serialize_nurse_call(call),
                    })

    except WebSocketDisconnect:
        manager.disconnect(pid, websocket)
    except Exception:
        manager.disconnect(pid, websocket)


def _serialize_nurse_call(call) -> dict:
    return {
        "id": str(call.id),
        "status": call.status.value,
        "called_at": call.called_at.isoformat() if call.called_at else None,
        "accepted_at": call.accepted_at.isoformat() if call.accepted_at else None,
        "en_route_at": call.en_route_at.isoformat() if call.en_route_at else None,
        "on_site_at": call.on_site_at.isoformat() if call.on_site_at else None,
        "resolved_at": call.resolved_at.isoformat() if call.resolved_at else None,
        "accepted_by_name": (
            f"{call.accepted_by.last_name} {call.accepted_by.first_name[0]}."
            if call.accepted_by else None
        ),
        "response_time_seconds": call.response_time_seconds,
    }


# ── REST: Cameras ────────────────────────────────────────────────────────────

@router.get("/{patient_id}/cameras")
async def get_cameras(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    room_id = await service._get_patient_room_id(patient_id, current_user.clinic_id)
    if not room_id:
        return []
    cameras = await service.get_cameras(room_id, current_user.clinic_id)
    return [
        {
            "id": c.id, "room_id": c.room_id, "name": c.name,
            "camera_type": c.camera_type.value, "stream_url": c.stream_url,
            "is_active": c.is_active, "position_order": c.position_order,
        }
        for c in cameras
    ]


@router.post("/cameras", status_code=201)
async def create_camera(data: CameraCreate, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    camera = await service.create_camera(current_user.clinic_id, data.model_dump())
    return {"id": camera.id, "name": camera.name}


@router.patch("/cameras/{camera_id}")
async def update_camera(
    camera_id: uuid.UUID, data: CameraUpdate, session: DBSession, current_user: CurrentUser,
):
    service = MonitoringService(session)
    camera = await service.update_camera(camera_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {"id": camera.id, "name": camera.name, "is_active": camera.is_active}


@router.delete("/cameras/{camera_id}", status_code=204)
async def delete_camera(camera_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    await service.delete_camera(camera_id, current_user.clinic_id)


# ── REST: Sensors ────────────────────────────────────────────────────────────

@router.get("/{patient_id}/sensors")
async def get_sensors(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    sensors = await service.get_sensors(patient_id, current_user.clinic_id)
    return [
        {
            "id": s.id, "room_id": s.room_id, "patient_id": s.patient_id,
            "device_type": s.device_type.value, "device_category": s.device_category.value,
            "name": s.name, "is_active": s.is_active,
            "last_reading_at": s.last_reading_at,
        }
        for s in sensors
    ]


@router.get("/{patient_id}/sensors/current")
async def get_current_readings(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    return await service.get_current_readings(patient_id, current_user.clinic_id)


@router.get("/{patient_id}/sensors/{sensor_id}/readings")
async def get_sensor_readings(
    patient_id: uuid.UUID, sensor_id: uuid.UUID,
    session: DBSession, current_user: CurrentUser,
    hours: int = Query(24, ge=1, le=168),
):
    service = MonitoringService(session)
    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(hours=hours)
    readings = await service.get_sensor_readings(sensor_id, from_dt, now)
    return [
        {
            "value": r.value, "value_secondary": r.value_secondary,
            "value_text": r.value_text, "unit": r.unit,
            "recorded_at": r.recorded_at,
        }
        for r in readings
    ]


@router.post("/sensors", status_code=201)
async def create_sensor(data: SensorCreate, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    sensor = await service.create_sensor(current_user.clinic_id, data.model_dump())
    return {"id": sensor.id, "name": sensor.name}


@router.delete("/sensors/{sensor_id}", status_code=204)
async def delete_sensor(sensor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    await service.delete_sensor(sensor_id, current_user.clinic_id)


# ── REST: Alerts ─────────────────────────────────────────────────────────────

@router.get("/{patient_id}/alerts")
async def get_alerts(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = Query(None), severity: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    service = MonitoringService(session)
    alerts = await service.get_alerts(
        patient_id, current_user.clinic_id, status=status, severity=severity, limit=limit,
    )
    return [
        {
            "id": a.id, "patient_id": a.patient_id, "alert_type": a.alert_type.value,
            "severity": a.severity.value, "title": a.title, "message": a.message,
            "status": a.status.value,
            "acknowledged_by_name": (
                f"{a.acknowledged_by.last_name} {a.acknowledged_by.first_name[0]}."
                if a.acknowledged_by else None
            ),
            "acknowledged_at": a.acknowledged_at,
            "resolved_by_name": (
                f"{a.resolved_by.last_name} {a.resolved_by.first_name[0]}."
                if a.resolved_by else None
            ),
            "resolved_at": a.resolved_at,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    alert = await service.acknowledge_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": alert.status.value}


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    alert = await service.resolve_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": alert.status.value}


# ── REST: Nurse Calls ────────────────────────────────────────────────────────

@router.get("/{patient_id}/nurse-calls")
async def get_nurse_calls(
    patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    status: str | None = Query(None), limit: int = Query(20, ge=1, le=100),
):
    service = MonitoringService(session)
    calls = await service.get_nurse_calls(
        patient_id, current_user.clinic_id, status=status, limit=limit,
    )
    return [_serialize_nurse_call(c) | {"created_at": c.created_at} for c in calls]


@router.post("/{patient_id}/nurse-calls", status_code=201)
async def create_nurse_call(patient_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    room_id = await service._get_patient_room_id(patient_id, current_user.clinic_id)
    if not room_id:
        from app.core.exceptions import ValidationError
        raise ValidationError("Пациент не размещён в палате")
    call = await service.create_nurse_call(current_user.clinic_id, patient_id, room_id)
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/accept")
async def accept_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "ACCEPTED", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/en-route")
async def en_route_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "EN_ROUTE", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/on-site")
async def on_site_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "ON_SITE", current_user.id,
    )
    return _serialize_nurse_call(call)


@router.patch("/nurse-calls/{call_id}/resolve")
async def resolve_nurse_call(call_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = MonitoringService(session)
    call = await service.update_nurse_call_status(
        call_id, current_user.clinic_id, "RESOLVED", current_user.id,
    )
    return _serialize_nurse_call(call)
