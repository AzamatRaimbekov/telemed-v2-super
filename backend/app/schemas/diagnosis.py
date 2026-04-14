from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class DiagnosisCreate(BaseModel):
    icd_code: str = Field(..., max_length=20)
    title: str = Field(..., max_length=500)
    description: str | None = None
    status: str = "active"
    diagnosed_at: datetime | None = None
    visit_id: uuid.UUID | None = None
    notes: str | None = None


class DiagnosisUpdate(BaseModel):
    icd_code: str | None = Field(default=None, max_length=20)
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    status: str | None = None
    diagnosed_at: datetime | None = None
    resolved_at: datetime | None = None
    notes: str | None = None
