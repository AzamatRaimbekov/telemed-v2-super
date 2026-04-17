from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.deps import CurrentUser, DBSession
from app.core.database import async_session_factory
from app.core.security import decode_token
from app.schemas.bms import (
    BuildingCreate,
    FloorCreate, FloorUpdate,
    ZoneCreate, ZoneUpdate,
    BmsRoomCreate, BmsRoomUpdate,
    BmsSensorCreate, BmsSensorUpdate,
    EquipmentCreate, EquipmentUpdate, EquipmentCommandCreate,
    AutomationRuleCreate, AutomationRuleUpdate,
)
from app.services.bms import BmsService

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure BMS"])


# ── WebSocket Connection Manager ─────────────────────────────────────────────

class BmsConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, list[WebSocket]] = {}  # clinic_id -> [ws, ...]

    async def connect(self, clinic_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(clinic_id, []).append(websocket)

    def disconnect(self, clinic_id: str, websocket: WebSocket) -> None:
        conns = self.active.get(clinic_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, clinic_id: str, data: dict) -> None:
        for ws in self.active.get(clinic_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


bms_manager = BmsConnectionManager()


# ── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def infrastructure_ws(websocket: WebSocket):
    """Real-time BMS WebSocket. Auth via query param ?token=..."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    clinic_id = payload.get("clinic_id", "")
    user_id = uuid.UUID(payload["sub"])
    cid = str(clinic_id)

    await bms_manager.connect(cid, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "equipment_command":
                async with async_session_factory() as session:
                    service = BmsService(session)
                    cmd = await service.send_command(
                        uuid.UUID(data["equipment_id"]),
                        uuid.UUID(clinic_id),
                        user_id,
                        data["command"],
                        data.get("parameters"),
                    )
                    await session.commit()
                    await bms_manager.broadcast(cid, {
                        "type": "equipment_command",
                        "equipment_id": str(cmd.equipment_id),
                        "command": cmd.command.value if hasattr(cmd.command, "value") else str(cmd.command),
                        "status": cmd.status.value if hasattr(cmd.status, "value") else str(cmd.status),
                    })

            elif msg_type == "acknowledge_alert":
                async with async_session_factory() as session:
                    service = BmsService(session)
                    alert = await service.acknowledge_alert(
                        uuid.UUID(data["alert_id"]),
                        uuid.UUID(clinic_id),
                        user_id,
                    )
                    await session.commit()
                    await bms_manager.broadcast(cid, {
                        "type": "alert_update",
                        "alert_id": str(alert.id),
                        "status": alert.status.value if hasattr(alert.status, "value") else str(alert.status),
                    })

    except WebSocketDisconnect:
        bms_manager.disconnect(cid, websocket)
    except Exception:
        bms_manager.disconnect(cid, websocket)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_enum(val) -> str:
    return val.value if hasattr(val, "value") else str(val)


def _serialize_dt(val) -> str | None:
    if val is None:
        return None
    return val.isoformat() if hasattr(val, "isoformat") else str(val)


def _user_short_name(user) -> str | None:
    if not user:
        return None
    return f"{user.last_name} {user.first_name[0]}."


# ── REST: Buildings ──────────────────────────────────────────────────────────

@router.get("/buildings")
async def get_buildings(session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    buildings = await service.get_buildings(current_user.clinic_id)
    return [
        {
            "id": b.id, "name": b.name, "address": b.address,
            "total_floors": b.total_floors, "description": b.description,
        }
        for b in buildings
    ]


@router.post("/buildings", status_code=201)
async def create_building(data: BuildingCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    building = await service.create_building(current_user.clinic_id, data.model_dump())
    return {"id": building.id, "name": building.name}


# ── REST: Floors ─────────────────────────────────────────────────────────────

@router.get("/buildings/{building_id}/floors")
async def get_floors(building_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    floors = await service.get_floors(building_id, current_user.clinic_id)
    return [
        {
            "id": f.id, "building_id": f.building_id, "floor_number": f.floor_number,
            "name": f.name, "grid_cols": f.grid_cols, "grid_rows": f.grid_rows,
            "sort_order": f.sort_order,
        }
        for f in floors
    ]


@router.post("/floors", status_code=201)
async def create_floor(data: FloorCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    floor = await service.create_floor(current_user.clinic_id, data.model_dump())
    return {"id": floor.id, "name": floor.name}


@router.patch("/floors/{floor_id}")
async def update_floor(
    floor_id: uuid.UUID, data: FloorUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    floor = await service.update_floor(floor_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {
        "id": floor.id, "name": floor.name, "grid_cols": floor.grid_cols,
        "grid_rows": floor.grid_rows,
    }


@router.delete("/floors/{floor_id}", status_code=204)
async def delete_floor(floor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    await service.delete_floor(floor_id, current_user.clinic_id)


# ── REST: Zones ──────────────────────────────────────────────────────────────

@router.post("/zones", status_code=201)
async def create_zone(data: ZoneCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    zone = await service.create_zone(current_user.clinic_id, data.model_dump())
    return {"id": zone.id, "name": zone.name, "color": zone.color}


@router.patch("/zones/{zone_id}")
async def update_zone(
    zone_id: uuid.UUID, data: ZoneUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    zone = await service.update_zone(zone_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {"id": zone.id, "name": zone.name, "color": zone.color}


@router.delete("/zones/{zone_id}", status_code=204)
async def delete_zone(zone_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    await service.delete_zone(zone_id, current_user.clinic_id)


# ── REST: Rooms ──────────────────────────────────────────────────────────────

@router.get("/floors/{floor_id}/rooms")
async def get_rooms(floor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    rooms = await service.get_rooms(floor_id, current_user.clinic_id)
    return [
        {
            "id": r.id, "floor_id": r.floor_id, "zone_id": r.zone_id,
            "name": r.name, "room_type": _serialize_enum(r.room_type),
            "grid_x": r.grid_x, "grid_y": r.grid_y,
            "grid_w": r.grid_w, "grid_h": r.grid_h,
            "linked_room_id": r.linked_room_id,
        }
        for r in rooms
    ]


@router.post("/rooms", status_code=201)
async def create_room(data: BmsRoomCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    room = await service.create_room(current_user.clinic_id, data.model_dump())
    return {"id": room.id, "name": room.name}


@router.patch("/rooms/{room_id}")
async def update_room(
    room_id: uuid.UUID, data: BmsRoomUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    room = await service.update_room(room_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {
        "id": room.id, "name": room.name,
        "room_type": _serialize_enum(room.room_type),
    }


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(room_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    await service.delete_room(room_id, current_user.clinic_id)


# ── REST: Sensors ────────────────────────────────────────────────────────────

@router.get("/floors/{floor_id}/sensors")
async def get_floor_sensors(floor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    sensors = await service.get_floor_sensors(floor_id, current_user.clinic_id)
    return [
        {
            "id": s.id, "bms_room_id": s.bms_room_id, "floor_id": s.floor_id,
            "sensor_type": _serialize_enum(s.sensor_type), "name": s.name,
            "serial_number": s.serial_number, "is_active": s.is_active,
            "last_value": s.last_value, "last_value_text": s.last_value_text,
            "last_reading_at": _serialize_dt(s.last_reading_at),
            "grid_x_offset": s.grid_x_offset, "grid_y_offset": s.grid_y_offset,
        }
        for s in sensors
    ]


@router.get("/sensors/{sensor_id}/readings")
async def get_sensor_readings(
    sensor_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    hours: int = Query(24, ge=1, le=168),
):
    service = BmsService(session)
    now = datetime.now(timezone.utc)
    from_dt = now - timedelta(hours=hours)
    readings = await service.get_sensor_readings(sensor_id, from_dt, now)
    return [
        {
            "id": r.id, "sensor_id": r.sensor_id,
            "value": r.value, "value_text": r.value_text,
            "unit": r.unit, "recorded_at": _serialize_dt(r.recorded_at),
        }
        for r in readings
    ]


@router.post("/sensors", status_code=201)
async def create_sensor(data: BmsSensorCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    sensor = await service.create_sensor(current_user.clinic_id, data.model_dump())
    return {"id": sensor.id, "name": sensor.name}


@router.patch("/sensors/{sensor_id}")
async def update_sensor(
    sensor_id: uuid.UUID, data: BmsSensorUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    sensor = await service.update_sensor(sensor_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return {"id": sensor.id, "name": sensor.name, "is_active": sensor.is_active}


@router.delete("/sensors/{sensor_id}", status_code=204)
async def delete_sensor(sensor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    await service.delete_sensor(sensor_id, current_user.clinic_id)


# ── REST: Equipment ──────────────────────────────────────────────────────────

@router.get("/floors/{floor_id}/equipment")
async def get_floor_equipment(floor_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    equipment = await service.get_floor_equipment(floor_id, current_user.clinic_id)
    return [
        {
            "id": e.id, "bms_room_id": e.bms_room_id,
            "equipment_type": _serialize_enum(e.equipment_type), "name": e.name,
            "model": e.model, "status": _serialize_enum(e.status),
            "parameters": e.parameters, "is_controllable": e.is_controllable,
            "last_status_change": _serialize_dt(e.last_status_change),
        }
        for e in equipment
    ]


@router.get("/rooms/{room_id}/equipment")
async def get_room_equipment(room_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    equipment = await service.get_room_equipment(room_id, current_user.clinic_id)
    return [
        {
            "id": e.id, "bms_room_id": e.bms_room_id,
            "equipment_type": _serialize_enum(e.equipment_type), "name": e.name,
            "model": e.model, "status": _serialize_enum(e.status),
            "parameters": e.parameters, "is_controllable": e.is_controllable,
            "last_status_change": _serialize_dt(e.last_status_change),
        }
        for e in equipment
    ]


@router.post("/equipment", status_code=201)
async def create_equipment(data: EquipmentCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    equipment = await service.create_equipment(current_user.clinic_id, data.model_dump())
    return {"id": equipment.id, "name": equipment.name}


@router.patch("/equipment/{equipment_id}")
async def update_equipment(
    equipment_id: uuid.UUID, data: EquipmentUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    equipment = await service.update_equipment(
        equipment_id, current_user.clinic_id, data.model_dump(exclude_unset=True),
    )
    return {
        "id": equipment.id, "name": equipment.name,
        "status": _serialize_enum(equipment.status),
    }


@router.post("/equipment/{equipment_id}/command", status_code=201)
async def send_equipment_command(
    equipment_id: uuid.UUID, data: EquipmentCommandCreate,
    session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    cmd = await service.send_command(
        equipment_id, current_user.clinic_id, current_user.id,
        data.command, data.parameters,
    )
    return {
        "id": cmd.id, "equipment_id": cmd.equipment_id,
        "command": _serialize_enum(cmd.command),
        "parameters": cmd.parameters,
        "issued_by_id": cmd.issued_by_id,
        "issued_by_name": _user_short_name(cmd.issued_by),
        "issued_at": _serialize_dt(cmd.issued_at),
        "status": _serialize_enum(cmd.status),
        "executed_at": _serialize_dt(cmd.executed_at),
        "error_message": cmd.error_message,
    }


@router.get("/equipment/{equipment_id}/commands")
async def get_equipment_commands(
    equipment_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
):
    service = BmsService(session)
    commands = await service.get_equipment_commands(equipment_id, limit)
    return [
        {
            "id": c.id, "equipment_id": c.equipment_id,
            "command": _serialize_enum(c.command),
            "parameters": c.parameters,
            "issued_by_id": c.issued_by_id,
            "issued_by_name": _user_short_name(c.issued_by),
            "issued_at": _serialize_dt(c.issued_at),
            "status": _serialize_enum(c.status),
            "executed_at": _serialize_dt(c.executed_at),
            "error_message": c.error_message,
        }
        for c in commands
    ]


# ── REST: Alerts ─────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts(
    session: DBSession, current_user: CurrentUser,
    status: str | None = Query(None),
    severity: str | None = Query(None),
    floor_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    service = BmsService(session)
    alerts = await service.get_alerts(
        current_user.clinic_id, status=status, severity=severity,
        floor_id=floor_id, limit=limit,
    )
    return [
        {
            "id": a.id, "floor_id": a.floor_id, "bms_room_id": a.bms_room_id,
            "sensor_id": a.sensor_id, "equipment_id": a.equipment_id,
            "alert_type": _serialize_enum(a.alert_type),
            "severity": _serialize_enum(a.severity),
            "title": a.title, "message": a.message,
            "status": _serialize_enum(a.status),
            "acknowledged_by_name": _user_short_name(a.acknowledged_by),
            "acknowledged_at": _serialize_dt(a.acknowledged_at),
            "resolved_by_name": _user_short_name(a.resolved_by),
            "resolved_at": _serialize_dt(a.resolved_at),
            "created_at": _serialize_dt(a.created_at),
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    alert = await service.acknowledge_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": _serialize_enum(alert.status)}


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    alert = await service.resolve_alert(alert_id, current_user.clinic_id, current_user.id)
    return {"id": alert.id, "status": _serialize_enum(alert.status)}


# ── REST: Automation Rules ───────────────────────────────────────────────────

@router.get("/automation/rules")
async def get_rules(session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    rules = await service.get_rules(current_user.clinic_id)
    return [_serialize_rule(r) for r in rules]


@router.post("/automation/rules", status_code=201)
async def create_rule(data: AutomationRuleCreate, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    rule = await service.create_rule(current_user.clinic_id, data.model_dump())
    return _serialize_rule(rule)


@router.patch("/automation/rules/{rule_id}")
async def update_rule(
    rule_id: uuid.UUID, data: AutomationRuleUpdate, session: DBSession, current_user: CurrentUser,
):
    service = BmsService(session)
    rule = await service.update_rule(rule_id, current_user.clinic_id, data.model_dump(exclude_unset=True))
    return _serialize_rule(rule)


@router.delete("/automation/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    await service.delete_rule(rule_id, current_user.clinic_id)


@router.patch("/automation/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    rule = await service.toggle_rule(rule_id, current_user.clinic_id)
    return _serialize_rule(rule)


@router.get("/automation/rules/{rule_id}/logs")
async def get_rule_logs(
    rule_id: uuid.UUID, session: DBSession, current_user: CurrentUser,
    limit: int = Query(50, ge=1, le=200),
):
    service = BmsService(session)
    logs = await service.get_rule_logs(rule_id, limit)
    return [
        {
            "id": l.id, "rule_id": l.rule_id,
            "triggered_at": _serialize_dt(l.triggered_at),
            "sensor_value": l.sensor_value,
            "action_taken": l.action_taken,
            "success": l.success,
            "error_message": l.error_message,
        }
        for l in logs
    ]


def _serialize_rule(r) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "is_active": r.is_active,
        "condition_sensor_type": _serialize_enum(r.condition_sensor_type),
        "condition_operator": _serialize_enum(r.condition_operator),
        "condition_value": r.condition_value,
        "condition_floor_id": r.condition_floor_id,
        "condition_room_id": r.condition_room_id,
        "action_equipment_type": _serialize_enum(r.action_equipment_type) if r.action_equipment_type else None,
        "action_equipment_id": r.action_equipment_id,
        "action_command": r.action_command,
        "action_parameters": r.action_parameters,
        "schedule_cron": r.schedule_cron,
        "schedule_description": r.schedule_description,
        "last_triggered_at": _serialize_dt(r.last_triggered_at),
        "trigger_count": r.trigger_count,
    }


# ── REST: Dashboard ──────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(session: DBSession, current_user: CurrentUser):
    service = BmsService(session)
    return await service.get_dashboard(current_user.clinic_id)
