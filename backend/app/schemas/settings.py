from __future__ import annotations

from pydantic import BaseModel, Field


# ── Exercise ──────────────────────────────────────────────────────────────────


class ExerciseCreate(BaseModel):
    name: str
    description: str | None = None
    category: str = Field(..., description="UPPER_LIMB, LOWER_LIMB, BALANCE, GAIT, COGNITIVE")
    difficulty: str = "MEDIUM"
    instructions: str | None = None
    demo_video_url: str | None = None
    default_sets: int = 3
    default_reps: int = 10
    target_joints: dict | None = None
    angle_thresholds: dict | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    difficulty: str | None = None
    instructions: str | None = None
    demo_video_url: str | None = None
    default_sets: int | None = None
    default_reps: int | None = None
    target_joints: dict | None = None
    angle_thresholds: dict | None = None


# ── Drug ──────────────────────────────────────────────────────────────────────


class DrugCreate(BaseModel):
    name: str
    generic_name: str | None = None
    brand: str | None = None
    category: str | None = None
    form: str = "TABLET"
    unit: str | None = None
    price: float | None = None
    requires_prescription: bool = True
    interactions: list | None = None
    contraindications: str | None = None


class DrugUpdate(BaseModel):
    name: str | None = None
    generic_name: str | None = None
    brand: str | None = None
    category: str | None = None
    form: str | None = None
    unit: str | None = None
    price: float | None = None
    requires_prescription: bool | None = None
    interactions: list | None = None
    contraindications: str | None = None


# ── Procedure ─────────────────────────────────────────────────────────────────


class ProcedureCreate(BaseModel):
    name: str
    code: str | None = None
    category: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    price: float | None = None
    requires_consent: bool = False


class ProcedureUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    category: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    price: float | None = None
    requires_consent: bool | None = None


# ── Lab Test ──────────────────────────────────────────────────────────────────


class LabTestCreate(BaseModel):
    name: str
    code: str
    category: str | None = None
    description: str | None = None
    reference_ranges: dict | None = None
    price: float | None = None
    turnaround_hours: int | None = None
    sample_type: str | None = None


class LabTestUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    category: str | None = None
    description: str | None = None
    reference_ranges: dict | None = None
    price: float | None = None
    turnaround_hours: int | None = None
    sample_type: str | None = None
