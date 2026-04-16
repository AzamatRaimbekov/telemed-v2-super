from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field

# Camera schemas
class CameraCreate(BaseModel):
    room_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=255)
    camera_type: str
    stream_url: str | None = None
    position_order: int = 0

class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    camera_type: str | None = None
    stream_url: str | None = None
    is_active: bool | None = None
    position_order: int | None = None

class CameraOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    name: str
    camera_type: str
    stream_url: str | None = None
    is_active: bool
    position_order: int
    model_config = {"from_attributes": True}

# Sensor schemas
class SensorCreate(BaseModel):
    room_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    device_type: str
    device_category: str
    name: str = Field(..., min_length=1, max_length=255)
    serial_number: str | None = None

class SensorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    serial_number: str | None = None

class SensorOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    device_type: str
    device_category: str
    name: str
    serial_number: str | None = None
    is_active: bool
    last_reading_at: datetime | None = None
    model_config = {"from_attributes": True}

class SensorCurrentReading(BaseModel):
    sensor_id: uuid.UUID
    device_type: str
    device_category: str
    name: str
    value: float | None = None
    value_secondary: float | None = None
    value_text: str | None = None
    unit: str
    recorded_at: datetime | None = None
    severity: str = "NORMAL"

class ReadingOut(BaseModel):
    id: uuid.UUID
    sensor_id: uuid.UUID
    value: float | None = None
    value_secondary: float | None = None
    value_text: str | None = None
    unit: str
    recorded_at: datetime

# Alert schemas
class AlertOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    room_id: uuid.UUID | None = None
    sensor_id: uuid.UUID | None = None
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

# Nurse Call schemas
class NurseCallOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    room_id: uuid.UUID
    status: str
    called_at: datetime
    accepted_at: datetime | None = None
    en_route_at: datetime | None = None
    on_site_at: datetime | None = None
    resolved_at: datetime | None = None
    accepted_by_name: str | None = None
    resolved_by_name: str | None = None
    response_time_seconds: int | None = None
    notes: str | None = None
    created_at: datetime
