from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class RoomTransfer(BaseModel):
    room_id: uuid.UUID
    bed_id: uuid.UUID
    placement_type: str | None = None
    transfer_reason: str | None = Field(default=None, max_length=200)
    condition_on_transfer: str | None = None
    notes: str | None = None


class RoomAssignmentOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    hospitalization_id: uuid.UUID | None = None
    department_id: uuid.UUID
    room_id: uuid.UUID
    bed_id: uuid.UUID
    placement_type: str | None = None
    assigned_at: datetime
    released_at: datetime | None = None
    duration_minutes: int | None = None
    transfer_reason: str | None = None
    transferred_by: uuid.UUID | None = None
    condition_on_transfer: str | None = None
    notes: str | None = None
    created_at: datetime
    department: dict | None = None
    room: dict | None = None
    bed: dict | None = None
    model_config = {"from_attributes": True}
