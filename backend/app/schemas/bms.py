from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Building ──────────────────────────────────────────────────────────

class BuildingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: str | None = None
    total_floors: int

class BuildingOut(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None = None
    total_floors: int
    description: str | None = None
    model_config = {"from_attributes": True}


# ── Floor ─────────────────────────────────────────────────────────────

class FloorCreate(BaseModel):
    building_id: uuid.UUID
    floor_number: int
    name: str = Field(..., min_length=1, max_length=255)
    grid_cols: int = 8
    grid_rows: int = 6

class FloorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    grid_cols: int | None = None
    grid_rows: int | None = None

class FloorOut(BaseModel):
    id: uuid.UUID
    building_id: uuid.UUID
    floor_number: int
    name: str
    grid_cols: int
    grid_rows: int
    sort_order: int
    model_config = {"from_attributes": True}


# ── Zone ──────────────────────────────────────────────────────────────

class ZoneCreate(BaseModel):
    floor_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    color: str = "#3B82F6"

class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    color: str | None = None

class ZoneOut(BaseModel):
    id: uuid.UUID
    floor_id: uuid.UUID
    name: str
    color: str
    model_config = {"from_attributes": True}


# ── BmsRoom ───────────────────────────────────────────────────────────

class BmsRoomCreate(BaseModel):
    floor_id: uuid.UUID
    zone_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    room_type: str
    grid_x: int
    grid_y: int
    grid_w: int = 1
    grid_h: int = 1

class BmsRoomUpdate(BaseModel):
    zone_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=255)
    room_type: str | None = None
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None

class BmsRoomOut(BaseModel):
    id: uuid.UUID
    floor_id: uuid.UUID
    zone_id: uuid.UUID | None = None
    name: str
    room_type: str
    grid_x: int
    grid_y: int
    grid_w: int
    grid_h: int
    linked_room_id: uuid.UUID | None = None
    model_config = {"from_attributes": True}


# ── BmsSensor ─────────────────────────────────────────────────────────

class BmsSensorCreate(BaseModel):
    bms_room_id: uuid.UUID
    floor_id: uuid.UUID
    sensor_type: str
    name: str = Field(..., min_length=1, max_length=255)

class BmsSensorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

class BmsSensorOut(BaseModel):
    id: uuid.UUID
    bms_room_id: uuid.UUID
    floor_id: uuid.UUID
    sensor_type: str
    name: str
    serial_number: str | None = None
    is_active: bool
    last_value: float | None = None
    last_value_text: str | None = None
    last_reading_at: datetime | None = None
    grid_x_offset: float
    grid_y_offset: float
    model_config = {"from_attributes": True}


# ── Equipment ─────────────────────────────────────────────────────────

class EquipmentCreate(BaseModel):
    bms_room_id: uuid.UUID
    equipment_type: str
    name: str = Field(..., min_length=1, max_length=255)
    model: str | None = None
    is_controllable: bool = True

class EquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    model: str | None = None
    status: str | None = None
    is_controllable: bool | None = None

class EquipmentOut(BaseModel):
    id: uuid.UUID
    bms_room_id: uuid.UUID
    equipment_type: str
    name: str
    model: str | None = None
    status: str
    parameters: dict | None = None
    is_controllable: bool
    last_status_change: datetime | None = None
    model_config = {"from_attributes": True}


# ── EquipmentCommand ──────────────────────────────────────────────────

class EquipmentCommandCreate(BaseModel):
    command: str
    parameters: dict | None = None

class EquipmentCommandOut(BaseModel):
    id: uuid.UUID
    equipment_id: uuid.UUID
    command: str
    parameters: dict | None = None
    issued_by_id: uuid.UUID
    issued_at: datetime
    status: str
    executed_at: datetime | None = None
    error_message: str | None = None
    model_config = {"from_attributes": True}


# ── BmsAlert ──────────────────────────────────────────────────────────

class BmsAlertOut(BaseModel):
    id: uuid.UUID
    floor_id: uuid.UUID | None = None
    bms_room_id: uuid.UUID | None = None
    sensor_id: uuid.UUID | None = None
    equipment_id: uuid.UUID | None = None
    alert_type: str
    severity: str
    title: str
    message: str
    status: str
    acknowledged_by_name: str | None = None
    acknowledged_at: datetime | None = None
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── AutomationRule ────────────────────────────────────────────────────

class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    condition_sensor_type: str
    condition_operator: str
    condition_value: float
    condition_floor_id: uuid.UUID | None = None
    condition_room_id: uuid.UUID | None = None
    action_equipment_type: str | None = None
    action_equipment_id: uuid.UUID | None = None
    action_command: str
    action_parameters: dict | None = None
    schedule_cron: str | None = None
    schedule_description: str | None = None

class AutomationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    condition_sensor_type: str | None = None
    condition_operator: str | None = None
    condition_value: float | None = None
    condition_floor_id: uuid.UUID | None = None
    condition_room_id: uuid.UUID | None = None
    action_equipment_type: str | None = None
    action_equipment_id: uuid.UUID | None = None
    action_command: str | None = None
    action_parameters: dict | None = None
    schedule_cron: str | None = None
    schedule_description: str | None = None

class AutomationRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    is_active: bool
    condition_sensor_type: str
    condition_operator: str
    condition_value: float
    condition_floor_id: uuid.UUID | None = None
    condition_room_id: uuid.UUID | None = None
    action_equipment_type: str | None = None
    action_equipment_id: uuid.UUID | None = None
    action_command: str
    action_parameters: dict | None = None
    schedule_cron: str | None = None
    schedule_description: str | None = None
    last_triggered_at: datetime | None = None
    trigger_count: int
    model_config = {"from_attributes": True}


# ── AutomationLog ────────────────────────────────────────────────────

class AutomationLogOut(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    triggered_at: datetime
    sensor_value: float | None = None
    action_taken: str
    success: bool
    error_message: str | None = None
    model_config = {"from_attributes": True}


# ── SensorReading ─────────────────────────────────────────────────────

class BmsSensorReadingOut(BaseModel):
    id: uuid.UUID
    sensor_id: uuid.UUID
    value: float | None = None
    value_text: str | None = None
    unit: str
    recorded_at: datetime
    model_config = {"from_attributes": True}
