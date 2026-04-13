from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class RecoveryGoalCreate(BaseModel):
    domain: str = Field(..., description="VITALS, LABS, SCALES, EXERCISES, TREATMENT")
    metric_key: str = Field(..., description="e.g. systolic_bp, hemoglobin, nihss")
    target_value: float


class RecoveryGoalOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    domain: str
    metric_key: str
    target_value: float | None = None
    set_by_id: uuid.UUID
    set_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecoveryGoalsBulkUpdate(BaseModel):
    goals: list[RecoveryGoalCreate]


class RecoveryDomainWeightCreate(BaseModel):
    domain: str = Field(..., description="VITALS, LABS, SCALES, EXERCISES, TREATMENT")
    weight: float = Field(..., ge=0.0, le=1.0)


class RecoveryDomainWeightOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    domain: str
    weight: float
    set_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecoveryWeightsBulkUpdate(BaseModel):
    weights: list[RecoveryDomainWeightCreate]
