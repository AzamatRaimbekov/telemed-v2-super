# Recovery Dynamics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recovery dynamics dashboard to the patient overview page that calculates and visualizes a composite recovery index (0–100%) from vitals, labs, scales, exercises, treatment plans, and rehab goals.

**Architecture:** Frontend-driven calculation. Backend provides raw data via existing APIs + 2 new endpoints for doctor-defined goals and domain weights. Frontend module `features/recovery/` contains pure calculator functions, a data-loading hook, and Recharts-based visualization components embedded in the existing overview page.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query + Recharts + Framer Motion + Tailwind (frontend)

---

### Task 1: Backend — Recovery models

**Files:**
- Create: `backend/app/models/recovery.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create recovery models file**

```python
# backend/app/models/recovery.py
from typing import Optional
import enum
import uuid
from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantMixin


class RecoveryDomain(str, enum.Enum):
    VITALS = "VITALS"
    LABS = "LABS"
    SCALES = "SCALES"
    EXERCISES = "EXERCISES"
    TREATMENT = "TREATMENT"


class RecoveryGoal(TenantMixin, Base):
    __tablename__ = "recovery_goals"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    domain: Mapped[RecoveryDomain] = mapped_column(Enum(RecoveryDomain), nullable=False)
    metric_key: Mapped[str] = mapped_column(String(100), nullable=False)
    target_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))
    set_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    set_by = relationship("User", foreign_keys=[set_by_id], lazy="selectin")


class RecoveryDomainWeight(TenantMixin, Base):
    __tablename__ = "recovery_domain_weights"
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    domain: Mapped[RecoveryDomain] = mapped_column(Enum(RecoveryDomain), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    set_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    set_by = relationship("User", foreign_keys=[set_by_id], lazy="selectin")
```

- [ ] **Step 2: Register models in `__init__.py`**

Add to `backend/app/models/__init__.py`:

```python
from app.models.recovery import RecoveryGoal, RecoveryDomainWeight
```

And add `"RecoveryGoal", "RecoveryDomainWeight"` to the `__all__` list.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/recovery.py backend/app/models/__init__.py
git commit -m "feat(recovery): add RecoveryGoal and RecoveryDomainWeight models"
```

---

### Task 2: Backend — Alembic migration

**Files:**
- Create: `backend/alembic/versions/b2c3d4e5f6g7_add_recovery_goals_and_weights.py`

- [ ] **Step 1: Generate migration**

Run: `cd backend && .venv/bin/python -m alembic revision --autogenerate -m "add recovery_goals and recovery_domain_weights tables"`

- [ ] **Step 2: Review generated migration**

Verify it creates two tables: `recovery_goals` and `recovery_domain_weights` with all columns from the models. Verify enum `recoverydomain` is created. Fix any issues.

- [ ] **Step 3: Run migration**

Run: `cd backend && .venv/bin/python -m alembic upgrade head`

Expected: migration applies cleanly.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(recovery): add migration for recovery_goals and recovery_domain_weights"
```

---

### Task 3: Backend — Schemas

**Files:**
- Create: `backend/app/schemas/recovery.py`

- [ ] **Step 1: Create Pydantic schemas**

```python
# backend/app/schemas/recovery.py
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/recovery.py
git commit -m "feat(recovery): add Pydantic schemas for recovery goals and weights"
```

---

### Task 4: Backend — Service

**Files:**
- Create: `backend/app/services/recovery.py`

- [ ] **Step 1: Create RecoveryService**

```python
# backend/app/services/recovery.py
from __future__ import annotations

import uuid
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recovery import RecoveryGoal, RecoveryDomainWeight, RecoveryDomain


class RecoveryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Goals
    # ------------------------------------------------------------------

    async def list_goals(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> list[RecoveryGoal]:
        query = select(RecoveryGoal).where(
            RecoveryGoal.patient_id == patient_id,
            RecoveryGoal.clinic_id == clinic_id,
            RecoveryGoal.is_deleted == False,
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def bulk_upsert_goals(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        set_by_id: uuid.UUID,
        goals: list[dict],
    ) -> list[RecoveryGoal]:
        # Soft-delete existing goals
        existing = await self.list_goals(patient_id, clinic_id)
        for goal in existing:
            goal.is_deleted = True

        # Insert new goals
        new_goals: list[RecoveryGoal] = []
        for g in goals:
            goal = RecoveryGoal(
                id=uuid.uuid4(),
                patient_id=patient_id,
                clinic_id=clinic_id,
                set_by_id=set_by_id,
                domain=RecoveryDomain(g["domain"]),
                metric_key=g["metric_key"],
                target_value=g.get("target_value"),
            )
            self.session.add(goal)
            new_goals.append(goal)

        await self.session.flush()
        for goal in new_goals:
            await self.session.refresh(goal)
        return new_goals

    # ------------------------------------------------------------------
    # Weights
    # ------------------------------------------------------------------

    async def list_weights(
        self, patient_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> list[RecoveryDomainWeight]:
        query = select(RecoveryDomainWeight).where(
            RecoveryDomainWeight.patient_id == patient_id,
            RecoveryDomainWeight.clinic_id == clinic_id,
            RecoveryDomainWeight.is_deleted == False,
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def bulk_upsert_weights(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        set_by_id: uuid.UUID,
        weights: list[dict],
    ) -> list[RecoveryDomainWeight]:
        # Soft-delete existing weights
        existing = await self.list_weights(patient_id, clinic_id)
        for w in existing:
            w.is_deleted = True

        # Insert new weights
        new_weights: list[RecoveryDomainWeight] = []
        for w in weights:
            weight = RecoveryDomainWeight(
                id=uuid.uuid4(),
                patient_id=patient_id,
                clinic_id=clinic_id,
                set_by_id=set_by_id,
                domain=RecoveryDomain(w["domain"]),
                weight=w["weight"],
            )
            self.session.add(weight)
            new_weights.append(weight)

        await self.session.flush()
        for w in new_weights:
            await self.session.refresh(w)
        return new_weights
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/recovery.py
git commit -m "feat(recovery): add RecoveryService with bulk upsert for goals and weights"
```

---

### Task 5: Backend — API routes

**Files:**
- Create: `backend/app/api/v1/routes/recovery.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create recovery routes**

```python
# backend/app/api/v1/routes/recovery.py
from __future__ import annotations

import uuid
from fastapi import APIRouter

from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.schemas.recovery import (
    RecoveryGoalsBulkUpdate,
    RecoveryWeightsBulkUpdate,
)
from app.services.recovery import RecoveryService

router = APIRouter(prefix="/patients", tags=["Recovery Dynamics"])


def _goal_to_dict(g) -> dict:
    set_by_name = None
    if g.set_by:
        set_by_name = f"{g.set_by.last_name} {g.set_by.first_name}"
    return {
        "id": g.id,
        "patient_id": g.patient_id,
        "domain": g.domain.value,
        "metric_key": g.metric_key,
        "target_value": float(g.target_value) if g.target_value is not None else None,
        "set_by_id": g.set_by_id,
        "set_by_name": set_by_name,
        "created_at": g.created_at,
        "updated_at": g.updated_at,
    }


def _weight_to_dict(w) -> dict:
    return {
        "id": w.id,
        "patient_id": w.patient_id,
        "domain": w.domain.value,
        "weight": float(w.weight),
        "set_by_id": w.set_by_id,
        "created_at": w.created_at,
        "updated_at": w.updated_at,
    }


@router.get("/{patient_id}/recovery-goals")
async def get_recovery_goals(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    svc = RecoveryService(session)
    goals = await svc.list_goals(patient_id, current_user.clinic_id)
    return [_goal_to_dict(g) for g in goals]


@router.put("/{patient_id}/recovery-goals")
async def update_recovery_goals(
    patient_id: uuid.UUID,
    body: RecoveryGoalsBulkUpdate,
    session: DBSession,
    user: CurrentUser = require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    svc = RecoveryService(session)
    goals = await svc.bulk_upsert_goals(
        patient_id, user.clinic_id, user.id,
        [g.model_dump() for g in body.goals],
    )
    await session.commit()
    return [_goal_to_dict(g) for g in goals]


@router.get("/{patient_id}/recovery-weights")
async def get_recovery_weights(
    patient_id: uuid.UUID,
    session: DBSession,
    current_user: CurrentUser,
):
    svc = RecoveryService(session)
    weights = await svc.list_weights(patient_id, current_user.clinic_id)
    return [_weight_to_dict(w) for w in weights]


@router.put("/{patient_id}/recovery-weights")
async def update_recovery_weights(
    patient_id: uuid.UUID,
    body: RecoveryWeightsBulkUpdate,
    session: DBSession,
    user: CurrentUser = require_role(UserRole.DOCTOR, UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    svc = RecoveryService(session)
    weights = await svc.bulk_upsert_weights(
        patient_id, user.clinic_id, user.id,
        [w.model_dump() for w in body.weights],
    )
    await session.commit()
    return [_weight_to_dict(w) for w in weights]
```

- [ ] **Step 2: Register routes in router.py**

In `backend/app/api/v1/router.py`, add:

```python
from app.api.v1.routes import auth, clinics, health, users, portal, patients, registration, staff, medical_history, rooms, ai, treatment, stroke, settings, recovery
```

And add:
```python
api_router.include_router(recovery.router)
```

- [ ] **Step 3: Verify backend starts**

Run: `cd backend && .venv/bin/python -c "from app.main import app; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/recovery.py backend/app/api/v1/router.py
git commit -m "feat(recovery): add GET/PUT endpoints for recovery goals and weights"
```

---

### Task 6: Frontend — Types and API client

**Files:**
- Create: `frontend/src/features/recovery/types.ts`
- Create: `frontend/src/features/recovery/api.ts`

- [ ] **Step 1: Create types**

```typescript
// frontend/src/features/recovery/types.ts

export type RecoveryDomainKey = "VITALS" | "LABS" | "SCALES" | "EXERCISES" | "TREATMENT";

export interface RecoveryGoal {
  id: string;
  patient_id: string;
  domain: RecoveryDomainKey;
  metric_key: string;
  target_value: number | null;
  set_by_id: string;
  set_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryDomainWeight {
  id: string;
  patient_id: string;
  domain: RecoveryDomainKey;
  weight: number;
  set_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface DomainScore {
  domain: RecoveryDomainKey;
  score: number | null; // 0-100, null = no data
  trend: number | null; // delta vs previous period
  dataPoints: { date: string; value: number }[];
}

export interface RecoveryIndex {
  overall: number | null;
  trend: number | null;
  domains: DomainScore[];
  sparkline: { date: string; value: number }[];
}

export type PeriodKey = "7d" | "30d" | "3m" | "all" | "custom";

export interface PeriodRange {
  key: PeriodKey;
  from: Date;
  to: Date;
}
```

- [ ] **Step 2: Create API client**

```typescript
// frontend/src/features/recovery/api.ts

import apiClient from "@/lib/api-client";

export const recoveryApi = {
  getGoals: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/recovery-goals`).then((r) => r.data),

  updateGoals: (patientId: string, goals: { domain: string; metric_key: string; target_value: number }[]) =>
    apiClient.put(`/patients/${patientId}/recovery-goals`, { goals }).then((r) => r.data),

  getWeights: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/recovery-weights`).then((r) => r.data),

  updateWeights: (patientId: string, weights: { domain: string; weight: number }[]) =>
    apiClient.put(`/patients/${patientId}/recovery-weights`, { weights }).then((r) => r.data),
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/recovery/types.ts frontend/src/features/recovery/api.ts
git commit -m "feat(recovery): add frontend types and API client for recovery endpoints"
```

---

### Task 7: Frontend — Recovery calculator (pure functions)

**Files:**
- Create: `frontend/src/features/recovery/lib/recovery-calculator.ts`

- [ ] **Step 1: Create calculator module**

```typescript
// frontend/src/features/recovery/lib/recovery-calculator.ts

import type { RecoveryGoal, RecoveryDomainKey, DomainScore, RecoveryIndex } from "../types";

// ---------------------------------------------------------------------------
// Default vital norms: [min, max]
// ---------------------------------------------------------------------------

const VITAL_NORMS: Record<string, [number, number]> = {
  systolic_bp: [110, 140],
  diastolic_bp: [70, 90],
  pulse: [60, 100],
  spo2: [95, 100],
  temperature: [36.0, 37.2],
  blood_glucose: [3.9, 6.1],
  respiratory_rate: [12, 20],
};

const VITAL_KEYS = Object.keys(VITAL_NORMS);

// ---------------------------------------------------------------------------
// Scale configs: direction and max
// ---------------------------------------------------------------------------

interface ScaleConfig {
  lowerIsBetter: boolean;
  maxScore: number;
  goodThreshold: number; // score at or beyond which we consider 100%
}

const SCALE_CONFIGS: Record<string, ScaleConfig> = {
  NIHSS: { lowerIsBetter: true, maxScore: 42, goodThreshold: 0 },
  MRS: { lowerIsBetter: true, maxScore: 6, goodThreshold: 1 },
  BARTHEL: { lowerIsBetter: false, maxScore: 100, goodThreshold: 100 },
  MMSE: { lowerIsBetter: false, maxScore: 30, goodThreshold: 24 },
  BECK_DEPRESSION: { lowerIsBetter: true, maxScore: 63, goodThreshold: 9 },
  DYSPHAGIA: { lowerIsBetter: true, maxScore: 20, goodThreshold: 0 },
};

// ---------------------------------------------------------------------------
// Default domain weights
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: Record<RecoveryDomainKey, number> = {
  VITALS: 0.25,
  LABS: 0.25,
  TREATMENT: 0.20,
  SCALES: 0.15,
  EXERCISES: 0.15,
};

// ---------------------------------------------------------------------------
// Helper: score a single metric against a [min, max] range
// ---------------------------------------------------------------------------

function scoreMetric(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100;
  // How far outside the range, as fraction of range width
  const rangeWidth = max - min;
  if (rangeWidth === 0) return value === min ? 100 : 0;
  const deviation = value < min ? min - value : value - max;
  // At 2x range width deviation, score = 0
  const maxDeviation = rangeWidth * 2;
  const score = Math.max(0, 100 * (1 - deviation / maxDeviation));
  return Math.round(score * 10) / 10;
}

// ---------------------------------------------------------------------------
// Vitals score
// ---------------------------------------------------------------------------

interface VitalRecord {
  recorded_at: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  pulse?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  blood_glucose?: number | null;
  respiratory_rate?: number | null;
}

export function calcVitalsScore(
  vitals: VitalRecord[],
  goals: RecoveryGoal[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (vitals.length === 0) return { score: null, dataPoints: [] };

  const goalsMap = new Map(goals.filter((g) => g.domain === "VITALS").map((g) => [g.metric_key, g.target_value]));

  // Score each vitals record
  const dataPoints: { date: string; value: number }[] = [];

  for (const v of vitals) {
    const scores: number[] = [];
    for (const key of VITAL_KEYS) {
      const rawValue = v[key as keyof VitalRecord] as number | null | undefined;
      if (rawValue == null) continue;
      const goalTarget = goalsMap.get(key);
      let min: number, max: number;
      if (goalTarget != null) {
        // Use goal as center with ±10% range
        min = goalTarget * 0.9;
        max = goalTarget * 1.1;
      } else {
        [min, max] = VITAL_NORMS[key];
      }
      scores.push(scoreMetric(rawValue, min, max));
    }
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      dataPoints.push({ date: v.recorded_at, value: Math.round(avg * 10) / 10 });
    }
  }

  const latest = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : null;
  return { score: latest, dataPoints };
}

// ---------------------------------------------------------------------------
// Labs score
// ---------------------------------------------------------------------------

interface LabResult {
  numeric_value?: number | null;
  reference_range?: string | null;
  is_abnormal?: boolean;
  resulted_at?: string | null;
  test_name?: string;
  test_code?: string;
}

function parseRefRange(ref: string | null | undefined): [number, number] | null {
  if (!ref) return null;
  // Handles "3.9-6.1", "3.9 - 6.1", "< 5.0", "> 1.0"
  const dashMatch = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (dashMatch) return [parseFloat(dashMatch[1]), parseFloat(dashMatch[2])];
  return null;
}

export function calcLabsScore(
  results: LabResult[],
  goals: RecoveryGoal[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (results.length === 0) return { score: null, dataPoints: [] };

  const goalsMap = new Map(goals.filter((g) => g.domain === "LABS").map((g) => [g.metric_key, g.target_value]));

  // Group by test, take latest per test
  const byTest = new Map<string, LabResult>();
  for (const r of results) {
    const key = r.test_code || r.test_name || "unknown";
    if (!byTest.has(key)) byTest.set(key, r);
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const [testKey, r] of byTest) {
    if (r.numeric_value == null) continue;

    const goalTarget = goalsMap.get(testKey);
    let range: [number, number] | null = null;

    if (goalTarget != null) {
      range = [goalTarget * 0.9, goalTarget * 1.1];
    } else {
      range = parseRefRange(r.reference_range);
    }

    if (!range) continue;

    const s = scoreMetric(r.numeric_value, range[0], range[1]);
    const weight = r.is_abnormal ? 2 : 1;
    totalScore += s * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : null;

  // Build timeline from all results with numeric values
  const dataPoints = results
    .filter((r) => r.numeric_value != null && r.resulted_at)
    .map((r) => {
      const range = parseRefRange(r.reference_range);
      const val = range ? scoreMetric(r.numeric_value!, range[0], range[1]) : 50;
      return { date: r.resulted_at!, value: val };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

// ---------------------------------------------------------------------------
// Scales score
// ---------------------------------------------------------------------------

interface Assessment {
  assessment_type: string;
  score: number | null;
  max_score?: number | null;
  assessed_at: string | null;
}

export function calcScalesScore(
  assessments: Assessment[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (assessments.length === 0) return { score: null, dataPoints: [] };

  // Group by type, sort by date
  const byType = new Map<string, Assessment[]>();
  for (const a of assessments) {
    if (a.score == null) continue;
    const list = byType.get(a.assessment_type) || [];
    list.push(a);
    byType.set(a.assessment_type, list);
  }

  if (byType.size === 0) return { score: null, dataPoints: [] };

  const typeScores: number[] = [];
  const dataPoints: { date: string; value: number }[] = [];

  for (const [type, items] of byType) {
    const config = SCALE_CONFIGS[type];
    if (!config) continue;

    const sorted = items.sort(
      (a, b) => new Date(a.assessed_at!).getTime() - new Date(b.assessed_at!).getTime()
    );

    for (const item of sorted) {
      const maxS = item.max_score ?? config.maxScore;
      let normalized: number;
      if (config.lowerIsBetter) {
        normalized = Math.max(0, Math.min(100, ((maxS - item.score!) / maxS) * 100));
      } else {
        normalized = Math.max(0, Math.min(100, (item.score! / maxS) * 100));
      }
      dataPoints.push({ date: item.assessed_at!, value: Math.round(normalized * 10) / 10 });
    }

    const latest = sorted[sorted.length - 1];
    const maxS = latest.max_score ?? config.maxScore;
    let latestNorm: number;
    if (config.lowerIsBetter) {
      latestNorm = Math.max(0, Math.min(100, ((maxS - latest.score!) / maxS) * 100));
    } else {
      latestNorm = Math.max(0, Math.min(100, (latest.score! / maxS) * 100));
    }
    typeScores.push(latestNorm);
  }

  const score = typeScores.length > 0
    ? Math.round((typeScores.reduce((a, b) => a + b, 0) / typeScores.length) * 10) / 10
    : null;

  dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

// ---------------------------------------------------------------------------
// Exercise score
// ---------------------------------------------------------------------------

interface ExerciseSession {
  accuracy_score?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export function calcExerciseScore(
  sessions: ExerciseSession[],
  expectedSessionsPerWeek: number = 5,
  periodDays: number = 30
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (sessions.length === 0) return { score: null, dataPoints: [] };

  const withAccuracy = sessions.filter((s) => s.accuracy_score != null);
  if (withAccuracy.length === 0) return { score: null, dataPoints: [] };

  // Accuracy component (40%)
  const avgAccuracy =
    withAccuracy.reduce((sum, s) => sum + s.accuracy_score!, 0) / withAccuracy.length;

  // Regularity component (30%)
  const expectedTotal = (periodDays / 7) * expectedSessionsPerWeek;
  const regularity = Math.min(100, (sessions.length / Math.max(1, expectedTotal)) * 100);

  // Progress component (30%) — compare first half vs second half accuracy
  const mid = Math.floor(withAccuracy.length / 2);
  let progress = 50; // neutral if not enough data
  if (mid > 0) {
    const firstHalf = withAccuracy.slice(0, mid);
    const secondHalf = withAccuracy.slice(mid);
    const avgFirst = firstHalf.reduce((s, e) => s + e.accuracy_score!, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + e.accuracy_score!, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    progress = Math.max(0, Math.min(100, 50 + delta));
  }

  const score = Math.round((avgAccuracy * 0.4 + regularity * 0.3 + progress * 0.3) * 10) / 10;

  const dataPoints = withAccuracy
    .filter((s) => s.started_at || s.completed_at)
    .map((s) => ({
      date: (s.completed_at || s.started_at)!,
      value: s.accuracy_score!,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

// ---------------------------------------------------------------------------
// Treatment plan score
// ---------------------------------------------------------------------------

interface TreatmentPlan {
  status: string;
  items?: TreatmentItem[];
}

interface TreatmentItem {
  status: string;
  scheduled_at?: string | null;
}

export function calcTreatmentScore(
  plans: TreatmentPlan[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  const activePlans = plans.filter((p) => p.status === "ACTIVE");
  if (activePlans.length === 0) return { score: null, dataPoints: [] };

  let totalItems = 0;
  let completedItems = 0;
  let overdueItems = 0;
  const now = new Date();

  for (const plan of activePlans) {
    const items = plan.items || [];
    for (const item of items) {
      if (item.status === "CANCELLED") continue;
      totalItems++;
      if (item.status === "COMPLETED") {
        completedItems++;
      } else if (
        item.status === "PENDING" &&
        item.scheduled_at &&
        new Date(item.scheduled_at) < now
      ) {
        overdueItems++;
      }
    }
  }

  if (totalItems === 0) return { score: null, dataPoints: [] };

  // Base score = completion %, penalty for overdue
  const completionPct = (completedItems / totalItems) * 100;
  const overduePenalty = (overdueItems / totalItems) * 20; // max 20% penalty
  const score = Math.max(0, Math.round((completionPct - overduePenalty) * 10) / 10);

  return { score, dataPoints: [] };
}

// ---------------------------------------------------------------------------
// Overall index
// ---------------------------------------------------------------------------

export function calcOverallIndex(
  domainScores: DomainScore[],
  customWeights: { domain: RecoveryDomainKey; weight: number }[]
): RecoveryIndex {
  const weightsMap = new Map<RecoveryDomainKey, number>();
  if (customWeights.length > 0) {
    for (const w of customWeights) weightsMap.set(w.domain, w.weight);
  }

  // Get available domains (those with non-null scores)
  const available = domainScores.filter((d) => d.score !== null);
  if (available.length === 0) {
    return { overall: null, trend: null, domains: domainScores, sparkline: [] };
  }

  // Calculate weights
  let totalWeight = 0;
  const effectiveWeights = new Map<RecoveryDomainKey, number>();
  for (const d of available) {
    const w = weightsMap.get(d.domain) ?? DEFAULT_WEIGHTS[d.domain] ?? 0;
    effectiveWeights.set(d.domain, w);
    totalWeight += w;
  }

  // Normalize and calculate
  let overall = 0;
  for (const d of available) {
    const normalizedWeight = effectiveWeights.get(d.domain)! / totalWeight;
    overall += d.score! * normalizedWeight;
  }
  overall = Math.round(overall * 10) / 10;

  // Trend from domain trends
  let trendSum = 0;
  let trendCount = 0;
  for (const d of available) {
    if (d.trend !== null) {
      const w = effectiveWeights.get(d.domain)! / totalWeight;
      trendSum += d.trend * w;
      trendCount++;
    }
  }
  const trend = trendCount > 0 ? Math.round(trendSum * 10) / 10 : null;

  // Build overall sparkline by merging domain data points
  const allPoints = new Map<string, { sum: number; count: number }>();
  for (const d of available) {
    for (const dp of d.dataPoints) {
      const dateKey = dp.date.slice(0, 10); // YYYY-MM-DD
      const entry = allPoints.get(dateKey) || { sum: 0, count: 0 };
      entry.sum += dp.value;
      entry.count++;
      allPoints.set(dateKey, entry);
    }
  }
  const sparkline = Array.from(allPoints.entries())
    .map(([date, { sum, count }]) => ({ date, value: Math.round((sum / count) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { overall, trend, domains: domainScores, sparkline };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/lib/recovery-calculator.ts
git commit -m "feat(recovery): add pure calculator functions for all 5 domains + overall index"
```

---

### Task 8: Frontend — useRecoveryData hook

**Files:**
- Create: `frontend/src/features/recovery/hooks/useRecoveryData.ts`

- [ ] **Step 1: Create the data loading hook**

```typescript
// frontend/src/features/recovery/hooks/useRecoveryData.ts

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { subDays, subMonths } from "date-fns";
import { patientsApi } from "@/features/patients/api";
import { recoveryApi } from "../api";
import {
  calcVitalsScore,
  calcLabsScore,
  calcScalesScore,
  calcExerciseScore,
  calcTreatmentScore,
  calcOverallIndex,
} from "../lib/recovery-calculator";
import type { PeriodKey, DomainScore, RecoveryIndex, RecoveryGoal, RecoveryDomainWeight } from "../types";

function getPeriodRange(key: PeriodKey, customFrom?: Date, customTo?: Date) {
  const to = customTo ?? new Date();
  let from: Date;
  switch (key) {
    case "7d": from = subDays(to, 7); break;
    case "30d": from = subDays(to, 30); break;
    case "3m": from = subMonths(to, 3); break;
    case "all": from = new Date(2000, 0, 1); break;
    case "custom": from = customFrom ?? subDays(to, 30); break;
  }
  return { from, to };
}

function filterByPeriod<T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  from: Date,
  to: Date
): T[] {
  return items.filter((item) => {
    const d = item[dateField];
    if (!d) return false;
    const date = new Date(d as string);
    return date >= from && date <= to;
  });
}

export function useRecoveryData(
  patientId: string,
  periodKey: PeriodKey = "30d",
  customFrom?: Date,
  customTo?: Date
) {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["patient-vitals", patientId],
        queryFn: () => patientsApi.getVitals(patientId),
      },
      {
        queryKey: ["patient-lab-results", patientId],
        queryFn: () => patientsApi.getLabResults(patientId),
      },
      {
        queryKey: ["patient-stroke-assessments", patientId],
        queryFn: () => patientsApi.getStrokeAssessments(patientId),
      },
      {
        queryKey: ["patient-exercise-sessions", patientId],
        queryFn: () => patientsApi.getExerciseSessions(patientId),
      },
      {
        queryKey: ["patient-treatment-plans", patientId],
        queryFn: () => patientsApi.getTreatmentPlans(patientId),
      },
      {
        queryKey: ["patient-recovery-goals", patientId],
        queryFn: () => recoveryApi.getGoals(patientId),
      },
      {
        queryKey: ["patient-recovery-weights", patientId],
        queryFn: () => recoveryApi.getWeights(patientId),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const [vitalsQ, labsQ, assessmentsQ, exercisesQ, plansQ, goalsQ, weightsQ] = queries;

  const recoveryIndex: RecoveryIndex | null = useMemo(() => {
    if (isLoading) return null;

    const { from, to } = getPeriodRange(periodKey, customFrom, customTo);
    const goals: RecoveryGoal[] = (goalsQ.data as RecoveryGoal[]) || [];
    const weights: RecoveryDomainWeight[] = (weightsQ.data as RecoveryDomainWeight[]) || [];

    // Period in days for exercise calculation
    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

    // Filter data by period
    const vitals = filterByPeriod((vitalsQ.data || []) as Record<string, unknown>[], "recorded_at", from, to);
    const labs = filterByPeriod((labsQ.data || []) as Record<string, unknown>[], "resulted_at", from, to);
    const assessments = filterByPeriod((assessmentsQ.data || []) as Record<string, unknown>[], "assessed_at", from, to);
    const exercises = filterByPeriod((exercisesQ.data || []) as Record<string, unknown>[], "started_at", from, to);
    const plans = (plansQ.data || []) as Record<string, unknown>[];

    // Calculate domain scores
    const vitalsResult = calcVitalsScore(vitals as never[], goals);
    const labsResult = calcLabsScore(labs as never[], goals);
    const scalesResult = calcScalesScore(assessments as never[]);
    const exerciseResult = calcExerciseScore(exercises as never[], 5, periodDays);
    const treatmentResult = calcTreatmentScore(plans as never[]);

    // Calculate previous period for trends
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const prevVitals = filterByPeriod((vitalsQ.data || []) as Record<string, unknown>[], "recorded_at", prevFrom, from);
    const prevLabs = filterByPeriod((labsQ.data || []) as Record<string, unknown>[], "resulted_at", prevFrom, from);
    const prevAssessments = filterByPeriod((assessmentsQ.data || []) as Record<string, unknown>[], "assessed_at", prevFrom, from);
    const prevExercises = filterByPeriod((exercisesQ.data || []) as Record<string, unknown>[], "started_at", prevFrom, from);

    const prevVitalsResult = calcVitalsScore(prevVitals as never[], goals);
    const prevLabsResult = calcLabsScore(prevLabs as never[], goals);
    const prevScalesResult = calcScalesScore(prevAssessments as never[]);
    const prevExerciseResult = calcExerciseScore(prevExercises as never[], 5, periodDays);

    function calcTrend(current: number | null, previous: number | null): number | null {
      if (current === null || previous === null) return null;
      return Math.round((current - previous) * 10) / 10;
    }

    const domainScores: DomainScore[] = [
      { domain: "VITALS", score: vitalsResult.score, trend: calcTrend(vitalsResult.score, prevVitalsResult.score), dataPoints: vitalsResult.dataPoints },
      { domain: "LABS", score: labsResult.score, trend: calcTrend(labsResult.score, prevLabsResult.score), dataPoints: labsResult.dataPoints },
      { domain: "SCALES", score: scalesResult.score, trend: calcTrend(scalesResult.score, prevScalesResult.score), dataPoints: scalesResult.dataPoints },
      { domain: "EXERCISES", score: exerciseResult.score, trend: calcTrend(exerciseResult.score, prevExerciseResult.score), dataPoints: exerciseResult.dataPoints },
      { domain: "TREATMENT", score: treatmentResult.score, trend: null, dataPoints: treatmentResult.dataPoints },
    ];

    return calcOverallIndex(
      domainScores,
      weights.map((w) => ({ domain: w.domain, weight: w.weight }))
    );
  }, [isLoading, periodKey, customFrom, customTo, vitalsQ.data, labsQ.data, assessmentsQ.data, exercisesQ.data, plansQ.data, goalsQ.data, weightsQ.data]);

  return {
    recoveryIndex,
    isLoading,
    isError,
    goals: (goalsQ.data as RecoveryGoal[]) || [],
    weights: (weightsQ.data as RecoveryDomainWeight[]) || [],
    rawData: {
      vitals: vitalsQ.data || [],
      labs: labsQ.data || [],
      assessments: assessmentsQ.data || [],
      exercises: exercisesQ.data || [],
      plans: plansQ.data || [],
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/hooks/useRecoveryData.ts
git commit -m "feat(recovery): add useRecoveryData hook with parallel queries and index calculation"
```

---

### Task 9: Frontend — PeriodSelector component

**Files:**
- Create: `frontend/src/features/recovery/components/PeriodSelector.tsx`

- [ ] **Step 1: Create PeriodSelector**

```tsx
// frontend/src/features/recovery/components/PeriodSelector.tsx

import { useState } from "react";
import type { PeriodKey } from "../types";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "3m", label: "3 мес" },
  { key: "all", label: "Всё" },
  { key: "custom", label: "Период" },
];

interface Props {
  value: PeriodKey;
  onChange: (key: PeriodKey, from?: Date, to?: Date) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function handleClick(key: PeriodKey) {
    if (key === "custom") {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
      onChange(key);
    }
  }

  function handleApplyCustom() {
    if (fromDate && toDate) {
      onChange("custom", new Date(fromDate), new Date(toDate));
      setShowDatePicker(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex bg-[var(--color-muted)] rounded-lg p-0.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => handleClick(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              value === opt.key
                ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showDatePicker && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-surface)] text-foreground"
          />
          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-surface)] text-foreground"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={!fromDate || !toDate}
            className="px-2 py-1 text-xs font-medium rounded-md bg-secondary text-white disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/PeriodSelector.tsx
git commit -m "feat(recovery): add PeriodSelector with quick buttons and custom date range"
```

---

### Task 10: Frontend — RecoveryIndexCard component

**Files:**
- Create: `frontend/src/features/recovery/components/RecoveryIndexCard.tsx`

- [ ] **Step 1: Create RecoveryIndexCard**

```tsx
// frontend/src/features/recovery/components/RecoveryIndexCard.tsx

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { RecoveryIndex, PeriodKey } from "../types";
import { PeriodSelector } from "./PeriodSelector";

function getScoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-tertiary)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function getScoreColorClass(score: number | null): string {
  if (score === null) return "text-[var(--color-text-tertiary)]";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

interface Props {
  index: RecoveryIndex | null;
  isLoading: boolean;
  periodKey: PeriodKey;
  onPeriodChange: (key: PeriodKey, from?: Date, to?: Date) => void;
}

export function RecoveryIndexCard({ index, isLoading, periodKey, onPeriodChange }: Props) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-[#1e3a5f]/50 to-[#2a1a4e]/50 rounded-2xl border border-border p-6 animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  const overall = index?.overall ?? null;
  const trend = index?.trend ?? null;
  const sparkline = index?.sparkline ?? [];

  return (
    <div className="bg-gradient-to-br from-[#1e3a5f]/30 to-[#2a1a4e]/30 rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
            Индекс восстановления
          </p>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${getScoreColorClass(overall)}`}>
              {overall !== null ? `${overall}%` : "—"}
            </span>
            {trend !== null && (
              <span className={`text-sm font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {trend >= 0 ? "▲" : "▼"} {trend >= 0 ? "+" : ""}{trend}%
              </span>
            )}
          </div>
        </div>
        {sparkline.length > 1 && (
          <div className="w-32 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getScoreColor(overall)}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <PeriodSelector value={periodKey} onChange={onPeriodChange} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/RecoveryIndexCard.tsx
git commit -m "feat(recovery): add RecoveryIndexCard with score, trend, sparkline and period selector"
```

---

### Task 11: Frontend — DomainWidget component

**Files:**
- Create: `frontend/src/features/recovery/components/DomainWidget.tsx`

- [ ] **Step 1: Create DomainWidget**

```tsx
// frontend/src/features/recovery/components/DomainWidget.tsx

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid } from "recharts";
import { Activity, TestTube, Brain, Dumbbell, ClipboardList, Target } from "lucide-react";
import type { DomainScore, RecoveryDomainKey } from "../types";

const DOMAIN_CONFIG: Record<
  RecoveryDomainKey,
  { label: string; color: string; icon: typeof Activity }
> = {
  VITALS: { label: "Витальные", color: "#3b82f6", icon: Activity },
  LABS: { label: "Анализы", color: "#f59e0b", icon: TestTube },
  SCALES: { label: "Шкалы", color: "#f43f5e", icon: Brain },
  EXERCISES: { label: "Упражнения", color: "#06b6d4", icon: Dumbbell },
  TREATMENT: { label: "План лечения", color: "#8b5cf6", icon: ClipboardList },
};

interface Props {
  domainScore: DomainScore;
  expandedContent?: React.ReactNode;
}

export function DomainWidget({ domainScore, expandedContent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const config = DOMAIN_CONFIG[domainScore.domain];
  const Icon = config?.icon ?? Target;
  const color = config?.color ?? "#888";
  const label = config?.label ?? domainScore.domain;
  const hasData = domainScore.score !== null;

  return (
    <div
      className={`bg-[var(--color-surface)] rounded-xl border border-border transition-all ${
        expanded ? "col-span-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => hasData && setExpanded(!expanded)}
        className={`w-full p-4 text-left ${hasData ? "cursor-pointer hover:bg-[var(--color-muted)]/50" : "cursor-default opacity-50"} rounded-xl transition-colors`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              {!hasData && (
                <p className="text-xs text-[var(--color-text-tertiary)]">Нет данных</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <>
                <span className="text-lg font-bold" style={{ color }}>
                  {domainScore.score}%
                </span>
                {domainScore.trend !== null && (
                  <span
                    className={`text-xs font-medium ${
                      domainScore.trend >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {domainScore.trend >= 0 ? "▲" : "▼"}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {hasData && domainScore.dataPoints.length > 1 && !expanded && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={domainScore.dataPoints}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && hasData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-4">
              {expandedContent || (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={domainScore.dataPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                        tickFormatter={(v: string) => new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelFormatter={(v: string) => new Date(v).toLocaleString("ru-RU")}
                      />
                      <ReferenceArea y1={70} y2={100} fill="#4ade80" fillOpacity={0.05} />
                      <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.05} />
                      <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.05} />
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/DomainWidget.tsx
git commit -m "feat(recovery): add DomainWidget with expand/collapse animation and charts"
```

---

### Task 12: Frontend — DomainWidgetsGrid component

**Files:**
- Create: `frontend/src/features/recovery/components/DomainWidgetsGrid.tsx`

- [ ] **Step 1: Create DomainWidgetsGrid**

```tsx
// frontend/src/features/recovery/components/DomainWidgetsGrid.tsx

import type { DomainScore } from "../types";
import { DomainWidget } from "./DomainWidget";

interface Props {
  domains: DomainScore[];
}

export function DomainWidgetsGrid({ domains }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {domains.map((d) => (
        <DomainWidget key={d.domain} domainScore={d} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/DomainWidgetsGrid.tsx
git commit -m "feat(recovery): add DomainWidgetsGrid 2-column layout"
```

---

### Task 13: Frontend — RecoveryDashboard container

**Files:**
- Create: `frontend/src/features/recovery/components/RecoveryDashboard.tsx`

- [ ] **Step 1: Create RecoveryDashboard**

```tsx
// frontend/src/features/recovery/components/RecoveryDashboard.tsx

import { useState } from "react";
import { useRecoveryData } from "../hooks/useRecoveryData";
import { RecoveryIndexCard } from "./RecoveryIndexCard";
import { DomainWidgetsGrid } from "./DomainWidgetsGrid";
import type { PeriodKey } from "../types";

interface Props {
  patientId: string;
}

export function RecoveryDashboard({ patientId }: Props) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { recoveryIndex, isLoading } = useRecoveryData(
    patientId,
    periodKey,
    customFrom,
    customTo
  );

  function handlePeriodChange(key: PeriodKey, from?: Date, to?: Date) {
    setPeriodKey(key);
    setCustomFrom(from);
    setCustomTo(to);
  }

  return (
    <div className="space-y-3">
      <RecoveryIndexCard
        index={recoveryIndex}
        isLoading={isLoading}
        periodKey={periodKey}
        onPeriodChange={handlePeriodChange}
      />
      {recoveryIndex && (
        <DomainWidgetsGrid domains={recoveryIndex.domains} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/RecoveryDashboard.tsx
git commit -m "feat(recovery): add RecoveryDashboard container with state management"
```

---

### Task 14: Frontend — Integrate into overview page

**Files:**
- Modify: `frontend/src/routes/_authenticated/patients.$patientId/overview.tsx`

- [ ] **Step 1: Add import**

At the top of `overview.tsx`, add:

```typescript
import { RecoveryDashboard } from "@/features/recovery/components/RecoveryDashboard";
```

- [ ] **Step 2: Insert RecoveryDashboard into the page**

In the `OverviewPage` component's return statement, after the "Закреплённый персонал" section and before `<PortalPasswordSection>`, insert:

```tsx
      {/* Recovery Dynamics Dashboard */}
      <RecoveryDashboard patientId={patientId} />
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authenticated/patients.\$patientId/overview.tsx
git commit -m "feat(recovery): integrate RecoveryDashboard into patient overview page"
```

---

### Task 15: Frontend — GoalsEditor component

**Files:**
- Create: `frontend/src/features/recovery/components/GoalsEditor.tsx`

- [ ] **Step 1: Create GoalsEditor inline form**

```tsx
// frontend/src/features/recovery/components/GoalsEditor.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recoveryApi } from "../api";
import type { RecoveryGoal, RecoveryDomainKey } from "../types";

const VITALS_METRICS = [
  { key: "systolic_bp", label: "АД систолическое", unit: "мм рт.ст." },
  { key: "diastolic_bp", label: "АД диастолическое", unit: "мм рт.ст." },
  { key: "pulse", label: "Пульс", unit: "уд/мин" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "temperature", label: "Температура", unit: "°C" },
  { key: "blood_glucose", label: "Глюкоза", unit: "ммоль/л" },
  { key: "respiratory_rate", label: "ЧДД", unit: "/мин" },
];

interface Props {
  patientId: string;
  domain: RecoveryDomainKey;
  existingGoals: RecoveryGoal[];
}

export function GoalsEditor({ patientId, domain, existingGoals }: Props) {
  const queryClient = useQueryClient();
  const existingMap = new Map(
    existingGoals
      .filter((g) => g.domain === domain)
      .map((g) => [g.metric_key, g.target_value])
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, val] of existingMap) {
      if (val !== null) initial[key] = String(val);
    }
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (goals: { domain: string; metric_key: string; target_value: number }[]) =>
      recoveryApi.updateGoals(patientId, goals),
    onSuccess: () => {
      toast.success("Цели обновлены");
      queryClient.invalidateQueries({ queryKey: ["patient-recovery-goals", patientId] });
    },
    onError: () => toast.error("Ошибка при сохранении целей"),
  });

  function handleSave() {
    const goals = Object.entries(values)
      .filter(([, v]) => v !== "")
      .map(([key, v]) => ({
        domain,
        metric_key: key,
        target_value: parseFloat(v),
      }));
    mutation.mutate(goals);
  }

  const metrics = domain === "VITALS" ? VITALS_METRICS : [];

  if (metrics.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Настройка целей для этого домена пока недоступна
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        Целевые значения
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.key}>
            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{m.label}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                value={values[m.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
                placeholder="—"
                className="w-full px-2 py-1 text-xs rounded-md border border-border bg-[var(--color-muted)] text-foreground"
              />
              <span className="text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-white hover:bg-secondary/90 disabled:opacity-40 transition-colors"
      >
        {mutation.isPending ? "Сохранение..." : "Сохранить цели"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/recovery/components/GoalsEditor.tsx
git commit -m "feat(recovery): add GoalsEditor inline form for doctor-defined target values"
```

---

### Task 16: Verification and cleanup

- [ ] **Step 1: Verify backend starts**

Run: `cd backend && .venv/bin/python -c "from app.main import app; print('Backend OK')"`

Expected: `Backend OK`

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: no errors

- [ ] **Step 3: Verify frontend dev server starts**

Run: `cd frontend && npx vite --host 2>&1 | head -10`

Expected: Vite dev server starts on a port

- [ ] **Step 4: Final commit with all remaining files**

If any files were missed, add and commit them:

```bash
git add -A frontend/src/features/recovery/
git commit -m "feat(recovery): complete recovery dynamics feature — dashboard with 5 domain widgets, index calculation, and goals editor"
```
