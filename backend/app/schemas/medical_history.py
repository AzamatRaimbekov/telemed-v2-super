from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class MedicalHistoryCreate(BaseModel):
    entry_type: str
    title: str = Field(default="Запись", max_length=200)
    recorded_at: datetime
    content: dict = Field(default_factory=dict)
    hospitalization_id: uuid.UUID | None = None
    source_type: str | None = None
    source_document_url: str | None = None
    ai_confidence: float | None = None
    linked_diagnosis_id: uuid.UUID | None = None
    linked_lab_id: uuid.UUID | None = None
    linked_procedure_id: uuid.UUID | None = None


class MedicalHistoryUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: dict | None = None
    recorded_at: datetime | None = None
    entry_type: str | None = None
    is_verified: bool | None = None
    source_type: str | None = None
    source_document_url: str | None = None
    ai_confidence: float | None = None
    linked_diagnosis_id: uuid.UUID | None = None
    linked_lab_id: uuid.UUID | None = None
    linked_procedure_id: uuid.UUID | None = None


class MedicalHistoryOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    hospitalization_id: uuid.UUID | None = None
    entry_type: str
    title: str
    recorded_at: datetime
    author_id: uuid.UUID | None = None
    is_verified: bool
    source_type: str | None = None
    source_document_url: str | None = None
    ai_confidence: float | None = None
    content: dict
    linked_diagnosis_id: uuid.UUID | None = None
    linked_lab_id: uuid.UUID | None = None
    linked_procedure_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    author: dict | None = None
    model_config = {"from_attributes": True}


class HistoryFilters(BaseModel):
    entry_type: str | None = None
    period: str | None = None
    author_id: uuid.UUID | None = None
