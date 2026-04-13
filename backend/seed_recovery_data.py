"""
Seed script: populate realistic recovery dynamics mock data for the dashboard.

Targets:
  Patient  : Асан Уметов  (22d1278e-cd6a-4bf4-8741-873f9fdca5af)
  Doctor   : Бакыт Исаков (b59f37e1-36a9-45b6-919b-20baee0a3ef4)
  Clinic   : ab676372-69fa-4af8-be33-91c1e307b4fc

Run:
  cd backend && .venv/bin/python seed_recovery_data.py
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone, date

# ── IDs from the live DB ──────────────────────────────────────────────────────
PATIENT_ID  = uuid.UUID("22d1278e-cd6a-4bf4-8741-873f9fdca5af")
DOCTOR_ID   = uuid.UUID("b59f37e1-36a9-45b6-919b-20baee0a3ef4")
CLINIC_ID   = uuid.UUID("ab676372-69fa-4af8-be33-91c1e307b4fc")

# Existing lab-test-catalog IDs
LAB_HEMOGLOBIN_ID   = uuid.UUID("e4df8b46-5526-4322-9f85-c862375d4020")  # LAB-001 CBC
LAB_BIOCHEM_ID      = uuid.UUID("437547bd-e80f-41e2-811c-ce7f1263e52c")  # LAB-002 Biochemistry
LAB_CRP_ID          = uuid.UUID("030e6c1c-f5ac-458a-9d7d-641e3050c842")  # LAB-011 CRP
LAB_GLUCOSE_ID      = uuid.UUID("f2767ab5-945d-4324-9bd3-fdebb3a8fd1e")  # LAB-005 Glucose
LAB_CHOLESTEROL_ID  = uuid.UUID("adf6f632-3206-4937-988e-9a89126f4f7d")  # LAB-006 Cholesterol

# Existing exercise IDs (mix of upper/lower/balance/gait)
EXERCISE_IDS = [
    uuid.UUID("91ecfd89-6fb6-4b81-831c-a41da766e7a6"),  # Тест подъём руки      UPPER_LIMB
    uuid.UUID("0039f79f-eb89-420b-8fdd-77d9fa13f895"),  # Переход сидя → стоя  LOWER_LIMB
    uuid.UUID("156fe535-7ffd-41dd-a6bb-501b8c6c8806"),  # Отведение плеча       UPPER_LIMB
    uuid.UUID("55512278-7f2c-46b1-b2af-bfbd426225a2"),  # Марш на месте         GAIT
    uuid.UUID("ab8a824b-cb24-4e67-a671-b800893b35d7"),  # Тандемная стойка      BALANCE
]

# Simulation start: 60 days ago from today
START = datetime(2026, 2, 12, 8, 0, 0, tzinfo=timezone.utc)

def lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation from a → b at progress t ∈ [0,1]."""
    return a + (b - a) * t

def jitter(v: float, pct: float = 0.04) -> float:
    """Add ±pct random noise (deterministic-ish via index trick)."""
    import random
    return v * (1 + random.uniform(-pct, pct))


# ── Main seed ─────────────────────────────────────────────────────────────────

async def seed():
    import random
    random.seed(42)

    from app.core.database import get_session
    from app.models.vital_signs import VitalSign
    from app.models.laboratory import LabOrder, LabResult, LabOrderPriority, LabOrderStatus, LabResultStatus
    from app.models.stroke import StrokeAssessment, AssessmentType
    from app.models.exercise import ExerciseSession
    from app.models.treatment import (
        TreatmentPlan, TreatmentPlanItem,
        TreatmentPlanStatus, TreatmentItemType, TreatmentItemStatus,
    )

    async for session in get_session():

        # ── 1. VITALS: 30 readings spread over 60 days ───────────────────────
        print("Seeding vitals …")
        vitals_added = 0
        for i in range(30):
            t = i / 29          # 0 → 1 over 30 readings
            day_offset = i * 2  # every 2 days
            ts = START + timedelta(days=day_offset, hours=random.randint(7, 18))

            v = VitalSign(
                id=uuid.uuid4(),
                clinic_id=CLINIC_ID,
                patient_id=PATIENT_ID,
                recorded_by_id=DOCTOR_ID,
                recorded_at=ts,
                systolic_bp=int(jitter(lerp(160, 125, t))),
                diastolic_bp=int(jitter(lerp(95, 80, t))),
                pulse=int(jitter(lerp(95, 72, t))),
                temperature=round(jitter(36.6 + (0.8 if i < 5 else 0.1), 0.005), 1),
                spo2=int(min(99, lerp(92, 98, t) + random.uniform(-0.5, 0.5))),
                respiratory_rate=int(jitter(lerp(22, 16, t))),
                blood_glucose=round(jitter(lerp(8.5, 5.2, t)), 2),
                weight=round(lerp(88.0, 84.5, t), 1),
            )
            session.add(v)
            vitals_added += 1

        await session.flush()
        print(f"  → {vitals_added} vital signs")

        # ── 2. LAB RESULTS: 5 tests × 3 time-points ─────────────────────────
        print("Seeding lab orders & results …")
        lab_specs = [
            # (test_id, label, unit, ref_range, start_val, end_val, abnormal_threshold_hi)
            (LAB_HEMOGLOBIN_ID,  "Гемоглобин",     "г/Л",     "120-160",  95.0, 125.0, 120.0),
            (LAB_BIOCHEM_ID,     "Лейкоциты",      "×10⁹/Л",  "4.0-10.0", 15.2,   7.8,  10.0),
            (LAB_CRP_ID,         "СРБ",            "мг/Л",    "0-5",      85.0,   3.2,   5.0),
            (LAB_GLUCOSE_ID,     "Глюкоза",        "ммоль/Л", "3.9-6.1",   9.1,   5.4,   6.1),
            (LAB_CHOLESTEROL_ID, "Холестерин",     "ммоль/Л", "3.0-5.2",   7.2,   5.1,   5.2),
        ]
        # 3 time-points: day 0, day 30, day 58
        time_points = [0, 30, 58]
        lab_added = 0
        for test_id, label, unit, ref_range, start_val, end_val, hi_threshold in lab_specs:
            for tp_idx, day in enumerate(time_points):
                t = tp_idx / (len(time_points) - 1)
                value = round(jitter(lerp(start_val, end_val, t), 0.02), 2)
                ordered_ts = START + timedelta(days=day, hours=9)
                resulted_ts = ordered_ts + timedelta(hours=random.randint(4, 24))

                order = LabOrder(
                    id=uuid.uuid4(),
                    clinic_id=CLINIC_ID,
                    patient_id=PATIENT_ID,
                    ordered_by_id=DOCTOR_ID,
                    test_id=test_id,
                    priority=LabOrderPriority.ROUTINE,
                    status=LabOrderStatus.COMPLETED,
                    created_at=ordered_ts,
                    collected_at=ordered_ts + timedelta(hours=1),
                )
                session.add(order)
                await session.flush()  # get order.id

                is_abnormal = value > hi_threshold or (label == "Гемоглобин" and value < 120)
                result = LabResult(
                    id=uuid.uuid4(),
                    clinic_id=CLINIC_ID,
                    lab_order_id=order.id,
                    value=str(value),
                    numeric_value=value,
                    unit=unit,
                    reference_range=ref_range,
                    is_abnormal=is_abnormal,
                    status=LabResultStatus.FINAL,
                    resulted_at=resulted_ts,
                    visible_to_patient=True,
                )
                session.add(result)
                lab_added += 1

        await session.flush()
        print(f"  → {lab_added} lab orders+results (5 tests × 3 time-points)")

        # ── 3. STROKE ASSESSMENTS ────────────────────────────────────────────
        print("Seeding stroke assessments …")
        assessment_schedules = [
            # (type, max_score, [scores_at_day_0, day_20, day_40, day_58], interpretations)
            (
                AssessmentType.NIHSS, 42,
                [18, 12, 7, 3],
                ["Умеренно-тяжёлый инсульт", "Умеренный инсульт",
                 "Лёгкий инсульт", "Минимальный неврологический дефицит"],
            ),
            (
                AssessmentType.MRS, 6,
                [4, 3, 2, 1],
                ["Умеренно тяжёлая инвалидность", "Умеренная инвалидность",
                 "Лёгкая инвалидность", "Незначительные симптомы"],
            ),
            (
                AssessmentType.BARTHEL, 100,
                [30, 55, 75, 90],
                ["Выраженная зависимость", "Умеренная зависимость",
                 "Лёгкая зависимость", "Почти независимость"],
            ),
            (
                AssessmentType.MMSE, 30,
                [18, 22, 25, 28],
                ["Умеренное когнитивное снижение", "Лёгкое когнитивное снижение",
                 "Лёгкое когнитивное снижение", "Норма"],
            ),
        ]
        assessment_days = [0, 20, 40, 58]
        sa_added = 0
        for atype, max_score, scores, interpretations in assessment_schedules:
            for idx, (day, score, interp) in enumerate(zip(assessment_days, scores, interpretations)):
                ts = START + timedelta(days=day, hours=10)
                sa = StrokeAssessment(
                    id=uuid.uuid4(),
                    clinic_id=CLINIC_ID,
                    patient_id=PATIENT_ID,
                    assessed_by_id=DOCTOR_ID,
                    assessment_type=atype,
                    score=score,
                    max_score=max_score,
                    assessed_at=ts,
                    interpretation=interp,
                )
                session.add(sa)
                sa_added += 1

        await session.flush()
        print(f"  → {sa_added} stroke assessments (4 scales × 4 time-points)")

        # ── 4. EXERCISE SESSIONS: 22 sessions over 60 days ──────────────────
        print("Seeding exercise sessions …")
        ex_added = 0
        # Roughly every 3 days, skip weekends occasionally
        session_days = sorted(random.sample(range(60), 22))
        for rank, day in enumerate(session_days):
            t = rank / (len(session_days) - 1)
            ex_id = EXERCISE_IDS[rank % len(EXERCISE_IDS)]
            started = START + timedelta(days=day, hours=random.randint(9, 16))
            duration = int(jitter(lerp(300, 900, t), 0.08))
            completed = started + timedelta(seconds=duration)

            es = ExerciseSession(
                id=uuid.uuid4(),
                clinic_id=CLINIC_ID,
                patient_id=PATIENT_ID,
                exercise_id=ex_id,
                duration_seconds=duration,
                reps_completed=int(jitter(lerp(5, 15, t), 0.1)),
                sets_completed=max(1, int(lerp(1, 3, t))),
                accuracy_score=round(min(100, jitter(lerp(40, 85, t), 0.06)), 2),
                started_at=started,
                completed_at=completed,
            )
            session.add(es)
            ex_added += 1

        await session.flush()
        print(f"  → {ex_added} exercise sessions")

        # ── 5. TREATMENT PLAN + ITEMS ────────────────────────────────────────
        print("Seeding treatment plan …")
        plan_start = (START).date()

        plan = TreatmentPlan(
            id=uuid.uuid4(),
            clinic_id=CLINIC_ID,
            patient_id=PATIENT_ID,
            doctor_id=DOCTOR_ID,
            title="Программа реабилитации после ишемического инсульта",
            description=(
                "Комплексная 60-дневная программа включает медикаментозную терапию, "
                "физическую реабилитацию, нейрокогнитивные упражнения и мониторинг."
            ),
            status=TreatmentPlanStatus.ACTIVE,
            start_date=plan_start,
            end_date=plan_start + timedelta(days=60),
        )
        session.add(plan)
        await session.flush()

        items_spec = [
            # (item_type, title, status, day_offset, sort_order)
            # 6 COMPLETED
            (TreatmentItemType.MEDICATION,  "Аспирин 100 мг — антиагрегант",            TreatmentItemStatus.COMPLETED,   0,  1),
            (TreatmentItemType.LAB_TEST,    "ОАК — базовый анализ (день 0)",             TreatmentItemStatus.COMPLETED,   0,  2),
            (TreatmentItemType.PROCEDURE,   "МРТ головного мозга",                        TreatmentItemStatus.COMPLETED,   2,  3),
            (TreatmentItemType.THERAPY,     "Логопедическая оценка",                      TreatmentItemStatus.COMPLETED,   5,  4),
            (TreatmentItemType.EXERCISE,    "ЛФК — начальный этап (нед. 1-2)",            TreatmentItemStatus.COMPLETED,   7,  5),
            (TreatmentItemType.LAB_TEST,    "Биохимия + СРБ + холестерин (день 30)",      TreatmentItemStatus.COMPLETED,  30,  6),
            # 3 IN_PROGRESS
            (TreatmentItemType.MEDICATION,  "Аторвастатин 40 мг — гиполипидемия",        TreatmentItemStatus.IN_PROGRESS, 14, 7),
            (TreatmentItemType.THERAPY,     "Физиотерапия — нейромышечная стимуляция",   TreatmentItemStatus.IN_PROGRESS, 20, 8),
            (TreatmentItemType.EXERCISE,    "ЛФК — активный этап (нед. 3-8)",            TreatmentItemStatus.IN_PROGRESS, 21, 9),
            # 2 PENDING
            (TreatmentItemType.LAB_TEST,    "Контрольный ОАК + СРБ (день 60)",           TreatmentItemStatus.PENDING,     58, 10),
            (TreatmentItemType.DIET,        "Консультация диетолога — средиземноморская диета", TreatmentItemStatus.PENDING, 55, 11),
            # 1 CANCELLED
            (TreatmentItemType.MONITORING,  "Суточное холтер-мониторирование (отменено)",TreatmentItemStatus.CANCELLED,    10, 12),
        ]

        items_added = 0
        for itype, title, status, day_offset, sort_order in items_spec:
            scheduled = datetime.combine(
                plan_start + timedelta(days=day_offset),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ).replace(hour=9)
            item = TreatmentPlanItem(
                id=uuid.uuid4(),
                clinic_id=CLINIC_ID,
                treatment_plan_id=plan.id,
                item_type=itype,
                title=title,
                status=status,
                scheduled_at=scheduled,
                sort_order=sort_order,
                assigned_to_id=DOCTOR_ID,
            )
            session.add(item)
            items_added += 1

        await session.flush()
        print(f"  → 1 treatment plan + {items_added} items")

        await session.commit()
        print("\nDone! Summary:")
        print(f"  Vitals          : 30")
        print(f"  Lab orders      : 15  (5 tests × 3 time-points)")
        print(f"  Lab results     : 15")
        print(f"  Stroke assess.  : 16  (4 scales × 4 time-points)")
        print(f"  Exercise sess.  : 22")
        print(f"  Treatment plan  : 1 plan, {items_added} items")
        break   # only one session iteration needed


if __name__ == "__main__":
    asyncio.run(seed())
