from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime
import uuid


class LabTestCatalogOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    category: str | None = None
    description: str | None = None
    sample_type: str | None = None
    turnaround_hours: int | None = None
    price: float | None = None
    model_config = {"from_attributes": True}


class LabTestCatalogCreate(BaseModel):
    name: str
    code: str
    category: str | None = None
    description: str | None = None
    sample_type: str | None = None
    turnaround_hours: int | None = None
    price: float | None = None
    reference_ranges: dict | None = None


class LabOrderCreate(BaseModel):
    patient_id: uuid.UUID
    test_id: uuid.UUID
    priority: str = "ROUTINE"
    notes: str | None = None
    expected_at: datetime | None = None


class LabOrderOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str | None = None
    test_id: uuid.UUID
    test_name: str | None = None
    test_code: str | None = None
    status: str
    priority: str
    notes: str | None = None
    ordered_at: datetime | None = None
    expected_at: datetime | None = None
    collected_at: datetime | None = None
    doctor_name: str | None = None
    model_config = {"from_attributes": True}


class LabOrderUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    notes: str | None = None
    collected_at: datetime | None = None


class LabResultCreate(BaseModel):
    lab_order_id: uuid.UUID
    value: str
    numeric_value: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    is_abnormal: bool = False
    notes: str | None = None
    status: str = "PRELIMINARY"


class LabResultUpdate(BaseModel):
    value: str | None = None
    numeric_value: float | None = None
    unit: str | None = None
    is_abnormal: bool | None = None
    notes: str | None = None
    status: str | None = None
    visible_to_patient: bool | None = None


class LabResultOut(BaseModel):
    id: uuid.UUID
    lab_order_id: uuid.UUID
    value: str
    numeric_value: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    is_abnormal: bool = False
    notes: str | None = None
    status: str
    visible_to_patient: bool = False
    resulted_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by_id: uuid.UUID | None = None
    test_name: str | None = None
    test_code: str | None = None
    patient_name: str | None = None
    model_config = {"from_attributes": True}


class LabStatsOut(BaseModel):
    total_orders: int = 0
    pending_orders: int = 0
    in_progress: int = 0
    completed_today: int = 0
    urgent_pending: int = 0
