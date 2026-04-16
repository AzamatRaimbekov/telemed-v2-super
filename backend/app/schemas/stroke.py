from __future__ import annotations

import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Assessment schemas
# ---------------------------------------------------------------------------


class AssessmentCreate(BaseModel):
    assessment_type: str = Field(..., description="NIHSS, MRS, BARTHEL, MMSE, BECK_DEPRESSION, DYSPHAGIA")
    score: float | None = None
    max_score: float | None = None
    responses: dict | None = None
    interpretation: str | None = None
    notes: str | None = None


class AssessmentUpdate(BaseModel):
    score: float | None = None
    max_score: float | None = None
    responses: dict | None = None
    interpretation: str | None = None
    notes: str | None = None


class AssessmentOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    assessed_by_id: uuid.UUID
    assessment_type: str
    score: float | None = None
    max_score: float | None = None
    responses: dict | None = None
    interpretation: str | None = None
    assessed_at: datetime | None = None
    notes: str | None = None
    assessed_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentTrend(BaseModel):
    latest_score: float | None = None
    initial_score: float | None = None
    change: float | None = None
    trend: str = "stable"


# ---------------------------------------------------------------------------
# Rehab goal schemas
# ---------------------------------------------------------------------------


class GoalCreate(BaseModel):
    domain: str = Field(..., description="MOBILITY, SPEECH, COGNITION, ADL, PSYCHOLOGICAL, SOCIAL")
    description: str
    target_date: date | None = None
    baseline_value: str | None = None
    target_value: str | None = None
    current_value: str | None = None


class GoalUpdate(BaseModel):
    domain: str | None = None
    description: str | None = None
    target_date: date | None = None
    baseline_value: str | None = None
    target_value: str | None = None
    current_value: str | None = None
    status: str | None = None


class GoalOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    domain: str
    description: str
    target_date: date | None = None
    baseline_value: str | None = None
    target_value: str | None = None
    current_value: str | None = None
    status: str
    set_by_id: uuid.UUID | None = None
    set_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalProgressOut(BaseModel):
    id: uuid.UUID
    domain: str
    description: str
    baseline: str | None = None
    target: str | None = None
    current: str | None = None
    progress_pct: float | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Progress record schemas
# ---------------------------------------------------------------------------


class ProgressCreate(BaseModel):
    value: str
    notes: str | None = None


class ProgressOut(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    recorded_by_id: uuid.UUID
    recorded_by_name: str | None = None
    value: str | None = None
    notes: str | None = None
    recorded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Exercise assignment schemas
# ---------------------------------------------------------------------------


class PatientExerciseOut(BaseModel):
    treatment_plan_item_id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_name: str
    category: str
    difficulty: str
    prescribed_sets: int | None = None
    prescribed_reps: int | None = None
    frequency: str | None = None
    sessions_completed: int = 0
    latest_accuracy: float | None = None


class ExerciseSessionOut(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise_name: str
    category: str
    duration_seconds: int | None = None
    reps_completed: int | None = None
    sets_completed: int | None = None
    accuracy_score: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Aggregated progress response
# ---------------------------------------------------------------------------


class ExerciseStats(BaseModel):
    total_sessions: int = 0
    this_week: int = 0
    avg_accuracy: float | None = None
    sessions_by_category: dict[str, int] = {}


class AggregatedProgress(BaseModel):
    assessments_summary: dict[str, AssessmentTrend] = {}
    goals: list[GoalProgressOut] = []
    exercise_stats: ExerciseStats = ExerciseStats()
