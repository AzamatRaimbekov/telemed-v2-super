from __future__ import annotations

import uuid
from datetime import date
from pydantic import BaseModel, Field


class TreatmentItemCreate(BaseModel):
    item_type: str = Field(..., description="MEDICATION, PROCEDURE, LAB_TEST, THERAPY, EXERCISE, DIET, MONITORING")
    title: str
    description: str | None = None
    configuration: dict | None = None
    frequency: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    sort_order: int = 0
    assigned_to_id: uuid.UUID | None = None


class TreatmentPlanCreateFull(BaseModel):
    patient_id: uuid.UUID
    title: str
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str = "DRAFT"
    items: list[TreatmentItemCreate] = []


class TreatmentPlanUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class TreatmentItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    configuration: dict | None = None
    frequency: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    assigned_to_id: uuid.UUID | None = None
    sort_order: int | None = None


class ItemReorder(BaseModel):
    item_ids: list[uuid.UUID]
