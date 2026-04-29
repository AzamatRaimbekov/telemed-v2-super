from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# --- Requests ---

class DiagnosisSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    symptoms: str = Field(..., min_length=3, max_length=5000)
    age: int | None = None
    sex: str | None = None
    existing_diagnoses: list[str] = Field(default_factory=list)


class ExamGenerateRequest(BaseModel):
    patient_id: uuid.UUID
    complaints: str = Field(..., min_length=3, max_length=5000)
    visit_type: str = "CONSULTATION"


class PatientSummaryRequest(BaseModel):
    patient_id: uuid.UUID


class ConclusionGenerateRequest(BaseModel):
    patient_id: uuid.UUID
    visit_id: uuid.UUID | None = None
    diagnoses: list[str] = Field(default_factory=list)
    exam_notes: str | None = None
    treatment: str | None = None


class OCRDocumentRequest(BaseModel):
    patient_id: uuid.UUID


class TreatmentSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str
    diagnosis_title: str
    age: int | None = None
    comorbidities: str | None = None


class LabOrderSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str
    diagnosis_title: str
    current_labs: str | None = None


class DischargeSummaryRequest(BaseModel):
    patient_id: uuid.UUID
    diagnoses: list[str] = Field(default_factory=list)
    treatment: str | None = None
    duration: str | None = None
    lab_results: str | None = None


# --- Responses ---

class SuggestedDiagnosis(BaseModel):
    icd_code: str
    title: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class DiagnosisSuggestResponse(BaseModel):
    suggestions: list[SuggestedDiagnosis]
    model_used: str
    provider: str


class ExamGenerateResponse(BaseModel):
    examination_text: str
    model_used: str
    provider: str


class PatientSummaryResponse(BaseModel):
    summary: str
    key_diagnoses: list[str]
    key_medications: list[str]
    risk_factors: list[str]
    model_used: str
    provider: str


class ConclusionGenerateResponse(BaseModel):
    conclusion_text: str
    model_used: str
    provider: str


class TreatmentSuggestResponse(BaseModel):
    plan: str
    medications: list[str]
    procedures: list[str]
    model_used: str
    provider: str


class LabOrderSuggestResponse(BaseModel):
    suggested_tests: list[str]
    reasoning: str
    model_used: str
    provider: str


class AIUsageStats(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    tokens_used: int
    by_provider: dict[str, int]
    by_task_type: dict[str, int]


class PromptTemplateRead(BaseModel):
    id: uuid.UUID
    task_type: str
    system_prompt: str
    user_prompt_template: str
    model_tier: str
    version: int
    is_active: bool
    created_at: datetime


class PromptTemplateUpdate(BaseModel):
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_tier: str | None = None
    is_active: bool | None = None
