from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.stroke import (
    StrokeAssessment,
    AssessmentType,
    RehabGoal,
    RehabDomain,
    RehabGoalStatus,
    RehabProgress,
)
from app.models.exercise import Exercise, ExerciseSession
from app.models.treatment import (
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStatus,
    TreatmentItemType,
    TreatmentItemStatus,
)


class StrokeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Assessments
    # ------------------------------------------------------------------

    async def list_assessments(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        assessment_type: str | None = None,
    ) -> list[StrokeAssessment]:
        query = select(StrokeAssessment).where(
            StrokeAssessment.patient_id == patient_id,
            StrokeAssessment.clinic_id == clinic_id,
            StrokeAssessment.is_deleted == False,
        )
        if assessment_type:
            query = query.where(
                StrokeAssessment.assessment_type == AssessmentType(assessment_type)
            )
        query = query.order_by(desc(StrokeAssessment.assessed_at), desc(StrokeAssessment.created_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_assessment(
        self,
        patient_id: uuid.UUID,
        data: dict,
        assessed_by_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> StrokeAssessment:
        now = datetime.now(timezone.utc)
        assessment = StrokeAssessment(
            id=uuid.uuid4(),
            patient_id=patient_id,
            assessed_by_id=assessed_by_id,
            clinic_id=clinic_id,
            assessment_type=AssessmentType(data["assessment_type"]),
            score=data.get("score"),
            max_score=data.get("max_score"),
            responses=data.get("responses"),
            interpretation=data.get("interpretation"),
            notes=data.get("notes"),
            assessed_at=now,
        )
        self.session.add(assessment)
        await self.session.flush()
        await self.session.refresh(assessment)
        return assessment

    async def get_assessment(
        self,
        assessment_id: uuid.UUID,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> StrokeAssessment:
        query = select(StrokeAssessment).where(
            StrokeAssessment.id == assessment_id,
            StrokeAssessment.patient_id == patient_id,
            StrokeAssessment.clinic_id == clinic_id,
            StrokeAssessment.is_deleted == False,
        )
        result = await self.session.execute(query)
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise NotFoundError("StrokeAssessment", str(assessment_id))
        return assessment

    async def update_assessment(
        self,
        assessment_id: uuid.UUID,
        patient_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
    ) -> StrokeAssessment:
        assessment = await self.get_assessment(assessment_id, patient_id, clinic_id)
        for key, value in data.items():
            if value is not None and hasattr(assessment, key):
                setattr(assessment, key, value)
        await self.session.flush()
        await self.session.refresh(assessment)
        return assessment

    async def delete_assessment(
        self,
        assessment_id: uuid.UUID,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> None:
        assessment = await self.get_assessment(assessment_id, patient_id, clinic_id)
        assessment.is_deleted = True
        await self.session.flush()

    async def get_latest_assessments(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> dict[str, StrokeAssessment]:
        """Return the latest assessment for each assessment type."""
        results: dict[str, StrokeAssessment] = {}
        for atype in AssessmentType:
            query = (
                select(StrokeAssessment)
                .where(
                    StrokeAssessment.patient_id == patient_id,
                    StrokeAssessment.clinic_id == clinic_id,
                    StrokeAssessment.is_deleted == False,
                    StrokeAssessment.assessment_type == atype,
                )
                .order_by(desc(StrokeAssessment.assessed_at), desc(StrokeAssessment.created_at))
                .limit(1)
            )
            result = await self.session.execute(query)
            row = result.scalar_one_or_none()
            if row:
                results[atype.value] = row
        return results

    # ------------------------------------------------------------------
    # Rehab goals
    # ------------------------------------------------------------------

    async def list_goals(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
        domain: str | None = None,
        status: str | None = None,
    ) -> list[RehabGoal]:
        query = select(RehabGoal).where(
            RehabGoal.patient_id == patient_id,
            RehabGoal.clinic_id == clinic_id,
            RehabGoal.is_deleted == False,
        )
        if domain:
            query = query.where(RehabGoal.domain == RehabDomain(domain))
        if status:
            query = query.where(RehabGoal.status == RehabGoalStatus(status))
        query = query.order_by(desc(RehabGoal.created_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_goal(
        self,
        patient_id: uuid.UUID,
        data: dict,
        set_by_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> RehabGoal:
        goal = RehabGoal(
            id=uuid.uuid4(),
            patient_id=patient_id,
            set_by_id=set_by_id,
            clinic_id=clinic_id,
            domain=RehabDomain(data["domain"]),
            description=data["description"],
            target_date=data.get("target_date"),
            baseline_value=str(data["baseline_value"]) if data.get("baseline_value") is not None else None,
            target_value=str(data["target_value"]) if data.get("target_value") is not None else None,
            current_value=str(data["current_value"]) if data.get("current_value") is not None else None,
            status=RehabGoalStatus.ACTIVE,
        )
        self.session.add(goal)
        await self.session.flush()
        await self.session.refresh(goal)
        return goal

    async def _get_goal(
        self,
        goal_id: uuid.UUID,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> RehabGoal:
        query = select(RehabGoal).where(
            RehabGoal.id == goal_id,
            RehabGoal.patient_id == patient_id,
            RehabGoal.clinic_id == clinic_id,
            RehabGoal.is_deleted == False,
        )
        result = await self.session.execute(query)
        goal = result.scalar_one_or_none()
        if not goal:
            raise NotFoundError("RehabGoal", str(goal_id))
        return goal

    async def update_goal(
        self,
        goal_id: uuid.UUID,
        patient_id: uuid.UUID,
        data: dict,
        clinic_id: uuid.UUID,
    ) -> RehabGoal:
        goal = await self._get_goal(goal_id, patient_id, clinic_id)
        for key, value in data.items():
            if value is not None and hasattr(goal, key):
                if key == "domain":
                    setattr(goal, key, RehabDomain(value))
                elif key == "status":
                    setattr(goal, key, RehabGoalStatus(value))
                else:
                    setattr(goal, key, value)
        await self.session.flush()
        await self.session.refresh(goal)
        return goal

    async def delete_goal(
        self,
        goal_id: uuid.UUID,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> None:
        goal = await self._get_goal(goal_id, patient_id, clinic_id)
        goal.is_deleted = True
        await self.session.flush()

    # ------------------------------------------------------------------
    # Progress records
    # ------------------------------------------------------------------

    async def add_progress(
        self,
        goal_id: uuid.UUID,
        patient_id: uuid.UUID,
        data: dict,
        recorded_by_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> RehabProgress:
        goal = await self._get_goal(goal_id, patient_id, clinic_id)

        now = datetime.now(timezone.utc)
        record = RehabProgress(
            id=uuid.uuid4(),
            goal_id=goal_id,
            recorded_by_id=recorded_by_id,
            clinic_id=clinic_id,
            value=data["value"],
            notes=data.get("notes"),
            recorded_at=now,
        )
        self.session.add(record)

        # Update goal's current_value
        goal.current_value = data["value"]

        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def list_progress(
        self,
        goal_id: uuid.UUID,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> list[RehabProgress]:
        # Verify goal belongs to patient
        await self._get_goal(goal_id, patient_id, clinic_id)

        query = (
            select(RehabProgress)
            .where(
                RehabProgress.goal_id == goal_id,
                RehabProgress.clinic_id == clinic_id,
                RehabProgress.is_deleted == False,
            )
            .order_by(desc(RehabProgress.recorded_at), desc(RehabProgress.created_at))
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Exercise assignments (from treatment plans)
    # ------------------------------------------------------------------

    async def get_patient_exercises(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> list[dict]:
        """Get exercises assigned to a patient from active treatment plans."""
        # Find active treatment plans
        plans_q = select(TreatmentPlan.id).where(
            TreatmentPlan.patient_id == patient_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.status == TreatmentPlanStatus.ACTIVE,
            TreatmentPlan.is_deleted == False,
        )
        plans_result = await self.session.execute(plans_q)
        plan_ids = [row[0] for row in plans_result.all()]

        if not plan_ids:
            return []

        # Get EXERCISE items from these plans
        items_q = select(TreatmentPlanItem).where(
            TreatmentPlanItem.treatment_plan_id.in_(plan_ids),
            TreatmentPlanItem.item_type == TreatmentItemType.EXERCISE,
            TreatmentPlanItem.is_deleted == False,
            TreatmentPlanItem.status != TreatmentItemStatus.CANCELLED,
        )
        items_result = await self.session.execute(items_q)
        items = list(items_result.scalars().all())

        if not items:
            return []

        # Collect exercise IDs
        exercise_ids: set[uuid.UUID] = set()
        for item in items:
            cfg = item.configuration or {}
            eid = cfg.get("exercise_id")
            if eid:
                exercise_ids.add(uuid.UUID(str(eid)))

        if not exercise_ids:
            return []

        # Batch fetch exercises
        ex_q = select(Exercise).where(Exercise.id.in_(exercise_ids))
        ex_result = await self.session.execute(ex_q)
        exercises_map = {e.id: e for e in ex_result.scalars().all()}

        # For each item, count sessions and get latest accuracy
        result_list: list[dict] = []
        for item in items:
            cfg = item.configuration or {}
            eid_str = cfg.get("exercise_id")
            if not eid_str:
                continue
            eid = uuid.UUID(str(eid_str))
            exercise = exercises_map.get(eid)
            if not exercise:
                continue

            # Count completed sessions
            count_q = select(func.count()).select_from(ExerciseSession).where(
                ExerciseSession.patient_id == patient_id,
                ExerciseSession.exercise_id == eid,
                ExerciseSession.clinic_id == clinic_id,
                ExerciseSession.is_deleted == False,
            )
            count_result = await self.session.execute(count_q)
            sessions_count = count_result.scalar_one()

            # Latest accuracy
            acc_q = (
                select(ExerciseSession.accuracy_score)
                .where(
                    ExerciseSession.patient_id == patient_id,
                    ExerciseSession.exercise_id == eid,
                    ExerciseSession.clinic_id == clinic_id,
                    ExerciseSession.is_deleted == False,
                    ExerciseSession.accuracy_score.isnot(None),
                )
                .order_by(desc(ExerciseSession.completed_at))
                .limit(1)
            )
            acc_result = await self.session.execute(acc_q)
            latest_acc_row = acc_result.first()
            latest_accuracy = float(latest_acc_row[0]) if latest_acc_row else None

            result_list.append({
                "treatment_plan_item_id": item.id,
                "exercise_id": eid,
                "exercise_name": exercise.name,
                "category": exercise.category.value,
                "difficulty": exercise.difficulty.value,
                "prescribed_sets": cfg.get("sets") or exercise.default_sets,
                "prescribed_reps": cfg.get("reps") or exercise.default_reps,
                "frequency": item.frequency,
                "sessions_completed": sessions_count,
                "latest_accuracy": latest_accuracy,
            })

        return result_list

    # ------------------------------------------------------------------
    # Exercise sessions history
    # ------------------------------------------------------------------

    async def get_exercise_sessions(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> list[dict]:
        query = (
            select(ExerciseSession)
            .where(
                ExerciseSession.patient_id == patient_id,
                ExerciseSession.clinic_id == clinic_id,
                ExerciseSession.is_deleted == False,
            )
            .order_by(desc(ExerciseSession.started_at), desc(ExerciseSession.created_at))
        )
        result = await self.session.execute(query)
        sessions = list(result.scalars().all())

        return [
            {
                "id": s.id,
                "exercise_id": s.exercise_id,
                "exercise_name": s.exercise.name if s.exercise else None,
                "category": s.exercise.category.value if s.exercise else None,
                "duration_seconds": s.duration_seconds,
                "reps_completed": s.reps_completed,
                "sets_completed": s.sets_completed,
                "accuracy_score": float(s.accuracy_score) if s.accuracy_score is not None else None,
                "started_at": s.started_at,
                "completed_at": s.completed_at,
                "created_at": s.created_at,
            }
            for s in sessions
        ]

    # ------------------------------------------------------------------
    # Aggregated rehab progress
    # ------------------------------------------------------------------

    async def get_aggregated_progress(
        self,
        patient_id: uuid.UUID,
        clinic_id: uuid.UUID,
    ) -> dict:
        # --- Assessment trends ---
        assessments_summary: dict[str, dict] = {}
        for atype in AssessmentType:
            query = (
                select(StrokeAssessment)
                .where(
                    StrokeAssessment.patient_id == patient_id,
                    StrokeAssessment.clinic_id == clinic_id,
                    StrokeAssessment.is_deleted == False,
                    StrokeAssessment.assessment_type == atype,
                    StrokeAssessment.score.isnot(None),
                )
                .order_by(asc(StrokeAssessment.assessed_at))
            )
            result = await self.session.execute(query)
            rows = list(result.scalars().all())
            if not rows:
                continue

            initial_score = float(rows[0].score)
            latest_score = float(rows[-1].score)
            change = latest_score - initial_score

            if change < 0:
                trend = "improving"
            elif change > 0:
                trend = "worsening"
            else:
                trend = "stable"

            assessments_summary[atype.value] = {
                "latest_score": latest_score,
                "initial_score": initial_score,
                "change": change,
                "trend": trend,
            }

        # --- Goals with progress percentage ---
        goals_data: list[dict] = []
        goals = await self.list_goals(patient_id, clinic_id)
        for g in goals:
            progress_pct: float | None = None
            try:
                baseline = float(g.baseline_value) if g.baseline_value else None
                target = float(g.target_value) if g.target_value else None
                current = float(g.current_value) if g.current_value else None
                if baseline is not None and target is not None and current is not None and target != baseline:
                    progress_pct = round((current - baseline) / (target - baseline) * 100, 1)
            except (ValueError, TypeError):
                pass

            goals_data.append({
                "id": g.id,
                "domain": g.domain.value,
                "description": g.description,
                "baseline": g.baseline_value,
                "target": g.target_value,
                "current": g.current_value,
                "progress_pct": progress_pct,
            })

        # --- Exercise stats ---
        total_q = select(func.count()).select_from(ExerciseSession).where(
            ExerciseSession.patient_id == patient_id,
            ExerciseSession.clinic_id == clinic_id,
            ExerciseSession.is_deleted == False,
        )
        total_result = await self.session.execute(total_q)
        total_sessions = total_result.scalar_one()

        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        week_q = select(func.count()).select_from(ExerciseSession).where(
            ExerciseSession.patient_id == patient_id,
            ExerciseSession.clinic_id == clinic_id,
            ExerciseSession.is_deleted == False,
            ExerciseSession.started_at >= week_ago,
        )
        week_result = await self.session.execute(week_q)
        this_week = week_result.scalar_one()

        avg_q = select(func.avg(ExerciseSession.accuracy_score)).where(
            ExerciseSession.patient_id == patient_id,
            ExerciseSession.clinic_id == clinic_id,
            ExerciseSession.is_deleted == False,
            ExerciseSession.accuracy_score.isnot(None),
        )
        avg_result = await self.session.execute(avg_q)
        avg_accuracy_raw = avg_result.scalar_one()
        avg_accuracy = round(float(avg_accuracy_raw), 2) if avg_accuracy_raw is not None else None

        # Sessions by category — join with Exercise
        cat_q = (
            select(Exercise.category, func.count())
            .join(ExerciseSession, ExerciseSession.exercise_id == Exercise.id)
            .where(
                ExerciseSession.patient_id == patient_id,
                ExerciseSession.clinic_id == clinic_id,
                ExerciseSession.is_deleted == False,
            )
            .group_by(Exercise.category)
        )
        cat_result = await self.session.execute(cat_q)
        sessions_by_category = {row[0].value: row[1] for row in cat_result.all()}

        return {
            "assessments_summary": assessments_summary,
            "goals": goals_data,
            "exercise_stats": {
                "total_sessions": total_sessions,
                "this_week": this_week,
                "avg_accuracy": avg_accuracy,
                "sessions_by_category": sessions_by_category,
            },
        }
