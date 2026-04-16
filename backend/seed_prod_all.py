"""
Production seed script — comprehensive mock data for all features.

Uses asyncpg directly (NOT SQLAlchemy ORM) to avoid enum mapping issues.
Targets patient Уметов Асан Бакирович and populates all related data.

Run:
  cd backend && .venv/bin/python seed_prod_all.py
"""

import asyncio
import json
import os
import random
import uuid
from datetime import date, datetime, timedelta, timezone

import asyncpg

# ---------------------------------------------------------------------------
# IDs from production database
# ---------------------------------------------------------------------------
CLINIC_ID = "ab676372-69fa-4af8-be33-91c1e307b4fc"
ADMIN_ID = "88d553e7-ba10-4f13-91cd-8a7456105625"
DOCTOR_ID = "b59f37e1-36a9-45b6-919b-20baee0a3ef4"  # Бакыт Исаков
PATIENT_ID = "22d1278e-cd6a-4bf4-8741-873f9fdca5af"  # Уметов Асан

# New user/patient IDs (stable for idempotency)
DOCTOR_NURLAN_ID = str(uuid.UUID("a1b2c3d4-1111-4aaa-bbbb-000000000001"))
NURSE_GULZAT_ID = str(uuid.UUID("a1b2c3d4-2222-4aaa-bbbb-000000000002"))
RECEPTIONIST_JANYL_ID = str(uuid.UUID("a1b2c3d4-3333-4aaa-bbbb-000000000003"))
DOCTOR_ERMEK_ID = str(uuid.UUID("a1b2c3d4-4444-4aaa-bbbb-000000000004"))

PATIENT_BERMET_ID = str(uuid.UUID("b1b2c3d4-1111-4aaa-bbbb-000000000001"))
PATIENT_KANAT_ID = str(uuid.UUID("b1b2c3d4-2222-4aaa-bbbb-000000000002"))
PATIENT_DINARA_ID = str(uuid.UUID("b1b2c3d4-3333-4aaa-bbbb-000000000003"))
PATIENT_ERMEK_B_ID = str(uuid.UUID("b1b2c3d4-4444-4aaa-bbbb-000000000004"))

ALL_DOCTORS = [DOCTOR_ID, DOCTOR_NURLAN_ID, DOCTOR_ERMEK_ID]
ALL_PATIENTS = [PATIENT_ID, PATIENT_BERMET_ID, PATIENT_KANAT_ID, PATIENT_DINARA_ID, PATIENT_ERMEK_B_ID]

# Existing exercise IDs from catalog
EXERCISE_IDS = [
    "91ecfd89-6fb6-4b81-831c-a41da766e7a6",
    "0039f79f-eb89-420b-8fdd-77d9fa13f895",
    "156fe535-7ffd-41dd-a6bb-501b8c6c8806",
    "55512278-7f2c-46b1-b2af-bfbd426225a2",
    "ab8a824b-cb24-4e67-a671-b800893b35d7",
]

# Existing lab test catalog IDs
LAB_HEMOGLOBIN_ID = "e4df8b46-5526-4322-9f85-c862375d4020"
LAB_BIOCHEM_ID = "437547bd-e80f-41e2-811c-ce7f1263e52c"
LAB_CRP_ID = "030e6c1c-f5ac-458a-9d7d-641e3050c842"
LAB_GLUCOSE_ID = "f2767ab5-945d-4324-9bd3-fdebb3a8fd1e"
LAB_CHOLESTEROL_ID = "adf6f632-3206-4937-988e-9a89126f4f7d"

now = datetime.now(timezone.utc)
random.seed(42)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def ts(days_offset: int, hour: int = 10, minute: int = 0) -> datetime:
    """Return a timezone-aware datetime offset from today."""
    return datetime(now.year, now.month, now.day, hour, minute, 0,
                    tzinfo=timezone.utc) + timedelta(days=days_offset)


def uid() -> str:
    return str(uuid.uuid4())


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def jitter(v: float, pct: float = 0.04) -> float:
    return v * (1 + random.uniform(-pct, pct))


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------
async def get_connection() -> asyncpg.Connection:
    """Build asyncpg connection from app settings."""
    # Import settings to get DB credentials
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app.core.config import settings

    dsn = (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )
    return await asyncpg.connect(dsn)


# ---------------------------------------------------------------------------
# Idempotency check
# ---------------------------------------------------------------------------
async def is_already_seeded(conn: asyncpg.Connection) -> bool:
    """Check if comprehensive seed data already exists."""
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM visits WHERE patient_id = $1",
        uuid.UUID(PATIENT_ID),
    )
    if count and count >= 6:
        return True
    return False


# ---------------------------------------------------------------------------
# 1. Additional Users (doctors, nurse, receptionist)
# ---------------------------------------------------------------------------
async def seed_users(conn: asyncpg.Connection):
    print("1. Seeding additional users ...")
    from app.core.security import hash_password
    pw_hash = hash_password("admin123")

    users = [
        (DOCTOR_NURLAN_ID, "doctor.neuro@medcore.kg", pw_hash,
         "Нурлан", "Жумабеков", None, None, "DOCTOR", "Невролог", True),
        (NURSE_GULZAT_ID, "nurse.gulzat@medcore.kg", pw_hash,
         "Гулзат", "Токтобаева", None, None, "NURSE", None, True),
        (RECEPTIONIST_JANYL_ID, "reception.janyl@medcore.kg", pw_hash,
         "Жаныл", "Асанова", None, None, "RECEPTIONIST", None, True),
        (DOCTOR_ERMEK_ID, "doctor.ermek@medcore.kg", pw_hash,
         "Эрмек", "Кадыров", None, None, "DOCTOR", "Терапевт", True),
    ]

    added = 0
    for (uid_val, email, hashed_pw, first, last, middle, phone,
         role, spec, is_active) in users:
        exists = await conn.fetchval(
            "SELECT 1 FROM users WHERE id = $1", uuid.UUID(uid_val)
        )
        if exists:
            continue
        await conn.execute(
            """
            INSERT INTO users
                (id, clinic_id, email, hashed_password, first_name, last_name,
                 middle_name, phone, role, specialization, is_active,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9::userrole, $10, $11,
                 false, $12, $12)
            ON CONFLICT (id) DO NOTHING
            """,
            uuid.UUID(uid_val), uuid.UUID(CLINIC_ID), email, hashed_pw,
            first, last, middle, phone, role, spec, is_active, now,
        )
        added += 1
    print(f"   -> {added} users added")


# ---------------------------------------------------------------------------
# 2. Additional Patients
# ---------------------------------------------------------------------------
async def seed_patients(conn: asyncpg.Connection):
    print("2. Seeding additional patients ...")

    patients = [
        (PATIENT_BERMET_ID, "Бермет", "Сыдыкова", "Канатовна",
         date(1990, 5, 20), "FEMALE", "AN2345678", "23456789012345",
         "г. Бишкек, ул. Киевская 45", "+996 555 200001", "B_POS"),
        (PATIENT_KANAT_ID, "Канат", "Жээнбеков", "Сагындыкович",
         date(1978, 11, 3), "MALE", "AN3456789", "34567890123456",
         "г. Бишкек, ул. Манаса 78", "+996 555 200002", "O_NEG"),
        (PATIENT_DINARA_ID, "Динара", "Абдыкалыкова", "Нурлановна",
         date(1965, 8, 14), "FEMALE", "AN4567890", "45678901234567",
         "г. Бишкек, ул. Ахунбаева 12", "+996 555 200003", "AB_POS"),
        (PATIENT_ERMEK_B_ID, "Эрмек", "Бообеков", "Талантович",
         date(1995, 1, 30), "MALE", "AN5678901", "56789012345678",
         "г. Бишкек, ул. Боконбаева 90", "+996 555 200004", "A_NEG"),
    ]

    added = 0
    for (pid, first, last, middle, dob, gender, passport, inn,
         address, phone, blood_type) in patients:
        exists = await conn.fetchval(
            "SELECT 1 FROM patients WHERE id = $1", uuid.UUID(pid)
        )
        if exists:
            continue
        await conn.execute(
            """
            INSERT INTO patients
                (id, clinic_id, first_name, last_name, middle_name,
                 date_of_birth, gender, passport_number, inn,
                 address, phone, blood_type,
                 assigned_doctor_id, registration_source, status,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7::gender, $8, $9,
                 $10, $11, $12::bloodtype,
                 $13, $14::registrationsource, $15::patientstatus,
                 false, $16, $16)
            ON CONFLICT (id) DO NOTHING
            """,
            uuid.UUID(pid), uuid.UUID(CLINIC_ID), first, last, middle,
            dob, gender, passport, inn,
            address, phone, blood_type,
            uuid.UUID(DOCTOR_ID), "WALK_IN", "ACTIVE", now,
        )
        added += 1
    print(f"   -> {added} patients added")


# ---------------------------------------------------------------------------
# 3. Medical Cards for ALL patients
# ---------------------------------------------------------------------------
async def seed_medical_cards(conn: asyncpg.Connection):
    print("3. Seeding medical cards ...")

    all_patients_for_cards = [
        (PATIENT_ID, "MC-PROD-1001"),
        (PATIENT_BERMET_ID, "MC-PROD-1002"),
        (PATIENT_KANAT_ID, "MC-PROD-1003"),
        (PATIENT_DINARA_ID, "MC-PROD-1004"),
        (PATIENT_ERMEK_B_ID, "MC-PROD-1005"),
    ]

    added = 0
    for pid, card_number in all_patients_for_cards:
        exists = await conn.fetchval(
            "SELECT 1 FROM medical_cards WHERE patient_id = $1",
            uuid.UUID(pid),
        )
        if exists:
            continue
        await conn.execute(
            """
            INSERT INTO medical_cards
                (id, clinic_id, patient_id, card_number, opened_at,
                 is_deleted, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, false, $5, $5)
            ON CONFLICT (id) DO NOTHING
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(pid),
            card_number, now - timedelta(days=60),
        )
        added += 1
    print(f"   -> {added} medical cards added")


# ---------------------------------------------------------------------------
# 4. Visits for Уметов Асан — 6 visits
# ---------------------------------------------------------------------------
async def seed_visits(conn: asyncpg.Connection):
    print("4. Seeding visits for Уметов Асан ...")

    # Get medical card ID for Уметов Асан
    mc_id = await conn.fetchval(
        "SELECT id FROM medical_cards WHERE patient_id = $1",
        uuid.UUID(PATIENT_ID),
    )

    visits = [
        # (days_ago, visit_type, status, doctor, diagnosis_codes, diagnosis_text, chief_complaint, notes)
        (-28, "EMERGENCY", "COMPLETED", DOCTOR_ID,
         [{"code": "I63.0", "desc": "Инфаркт мозга"}],
         "Ишемический инсульт в бассейне левой средней мозговой артерии",
         "Внезапная слабость в правой руке, нарушение речи",
         "Экстренная госпитализация. Тромболизис проведён в пределах терапевтического окна."),
        (-21, "FOLLOW_UP", "COMPLETED", DOCTOR_ID,
         [{"code": "I63.0", "desc": "Инфаркт мозга"}, {"code": "I10", "desc": "Гипертензия"}],
         "Контрольный осмотр. Положительная динамика.",
         "Контрольный осмотр после инсульта",
         "АД стабилизировано 140/85. Двигательная функция правой руки — улучшение."),
        (-14, "CONSULTATION", "COMPLETED", DOCTOR_NURLAN_ID,
         [{"code": "G81.9", "desc": "Гемипарез"}, {"code": "I63.0", "desc": "Инфаркт мозга"}],
         "Консультация невролога. Правосторонний гемипарез, восстановительный период.",
         "Консультация невролога",
         "NIHSS снизился с 18 до 10. Рекомендовано усиление ЛФК."),
        (-7, "FOLLOW_UP", "COMPLETED", DOCTOR_ID,
         [{"code": "I63.0", "desc": "Инфаркт мозга"}, {"code": "E11.9", "desc": "Диабет 2 типа"}],
         "Контрольный осмотр. Глюкоза повышена — скорректирована диета.",
         "Плановый осмотр, контроль глюкозы",
         "Глюкоза натощак 7.2 ммоль/Л. Назначена консультация эндокринолога."),
        (-3, "PROCEDURE", "COMPLETED", DOCTOR_ERMEK_ID,
         [{"code": "Z50.1", "desc": "Реабилитация"}],
         "Физиотерапия — нейромышечная электростимуляция",
         "Физиотерапевтическая процедура",
         "Проведён курс НМЭС на правую верхнюю конечность, 20 мин."),
        (2, "FOLLOW_UP", "SCHEDULED", DOCTOR_ID,
         None, None,
         "Плановый осмотр — неделя 5",
         "Запланирован контроль АД, глюкозы, оценка NIHSS."),
    ]

    added = 0
    for (days, vtype, status, doc_id, diag_codes, diag_text,
         complaint, notes) in visits:
        visit_dt = ts(days, hour=9, minute=30)
        ended_dt = visit_dt + timedelta(minutes=45) if status == "COMPLETED" else None
        await conn.execute(
            """
            INSERT INTO visits
                (id, clinic_id, patient_id, doctor_id, medical_card_id,
                 visit_type, status, chief_complaint, examination_notes,
                 diagnosis_codes, diagnosis_text,
                 started_at, ended_at,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 $6::visittype, $7::visitstatus, $8, $9,
                 $10::jsonb, $11,
                 $12, $13,
                 false, $14, $14)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            uuid.UUID(doc_id), mc_id,
            vtype, status, complaint, notes,
            json.dumps(diag_codes) if diag_codes else None, diag_text,
            visit_dt, ended_dt, now,
        )
        added += 1
    print(f"   -> {added} visits added")


# ---------------------------------------------------------------------------
# 5. Vital Signs — 30 records over 30 days
# ---------------------------------------------------------------------------
async def seed_vital_signs(conn: asyncpg.Connection):
    print("5. Seeding vital signs (30 records) ...")

    added = 0
    for i in range(30):
        t = i / 29  # 0 -> 1 progress
        day_offset = -30 + i  # from -30 to -1
        recorded = ts(day_offset, hour=random.randint(7, 18), minute=random.randint(0, 59))

        systolic = int(jitter(lerp(160, 125, t)))
        diastolic = int(jitter(lerp(95, 78, t)))
        pulse = int(jitter(lerp(92, 70, t)))
        temp = round(jitter(36.6 + (0.6 if i < 5 else 0.1), 0.005), 1)
        spo2 = int(min(99, lerp(93, 98, t) + random.uniform(-0.5, 0.5)))
        weight = round(lerp(80.0, 78.5, t), 1)
        resp_rate = int(jitter(lerp(22, 16, t)))
        glucose = round(jitter(lerp(8.0, 5.2, t)), 2)

        await conn.execute(
            """
            INSERT INTO vital_signs
                (id, clinic_id, patient_id, recorded_by_id, recorded_at,
                 systolic_bp, diastolic_bp, pulse, temperature,
                 spo2, weight, respiratory_rate, blood_glucose,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 $6, $7, $8, $9,
                 $10, $11, $12, $13,
                 false, $14, $14)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            uuid.UUID(DOCTOR_ID), recorded,
            systolic, diastolic, pulse, temp,
            spo2, weight, resp_rate, glucose,
            now,
        )
        added += 1
    print(f"   -> {added} vital sign records added")


# ---------------------------------------------------------------------------
# 6. Diagnoses — 7 for Уметов Асан
# ---------------------------------------------------------------------------
async def seed_diagnoses(conn: asyncpg.Connection):
    print("6. Seeding diagnoses ...")

    diagnoses = [
        # (icd_code, title, description, status, days_ago, doctor_id, notes)
        ("I63.0", "Инфаркт мозга, вызванный тромбозом прецеребральных артерий",
         "Ишемический инсульт в бассейне левой средней мозговой артерии",
         "active", -28, DOCTOR_ID,
         "Подтверждён КТ и МРТ. Тромболизис проведён."),
        ("I10", "Эссенциальная (первичная) гипертензия",
         "Артериальная гипертензия II степени, риск 4",
         "chronic", -28, DOCTOR_ID,
         "АД при поступлении 180/100. Назначена антигипертензивная терапия."),
        ("E11.9", "Сахарный диабет 2 типа без осложнений",
         "Впервые выявленный СД 2 типа на фоне инсульта",
         "active", -21, DOCTOR_ID,
         "Глюкоза натощак 9.1 ммоль/Л. Диетотерапия + контроль."),
        ("G81.9", "Гемипарез неуточнённый",
         "Правосторонний гемипарез после ишемического инсульта",
         "active", -28, DOCTOR_NURLAN_ID,
         "Мышечная сила правой руки — 2/5, правой ноги — 3/5."),
        ("R47.0", "Дисфазия и афазия",
         "Моторная афазия умеренной степени",
         "active", -27, DOCTOR_NURLAN_ID,
         "Затруднение экспрессивной речи. Понимание сохранено."),
        ("E78.0", "Чистая гиперхолестеринемия",
         "Гиперхолестеринемия, общий холестерин 7.2 ммоль/Л",
         "active", -21, DOCTOR_ID,
         "Назначен Аторвастатин 40 мг."),
        ("Z96.1", "Наличие внутриглазных линз",
         "Состояние после ишемического инсульта, восстановительный период",
         "active", -7, DOCTOR_ID,
         "Реабилитационный диагноз. Продолжена ЛФК."),
    ]

    added = 0
    for icd, title, desc, status, days, doc_id, notes in diagnoses:
        diagnosed_at = ts(days, hour=10)
        await conn.execute(
            """
            INSERT INTO diagnoses
                (id, clinic_id, patient_id, icd_code, title, description,
                 status, diagnosed_at, diagnosed_by_id, notes,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6,
                 $7::diagnosisstatus, $8, $9, $10,
                 false, $11, $11)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            icd, title, desc,
            status, diagnosed_at, uuid.UUID(doc_id), notes,
            now,
        )
        added += 1
    print(f"   -> {added} diagnoses added")


# ---------------------------------------------------------------------------
# 7. Medical History Entries — 12 entries
# ---------------------------------------------------------------------------
async def seed_medical_history(conn: asyncpg.Connection):
    print("7. Seeding medical history entries ...")

    entries = [
        # (entry_type, title, days_ago, author_id, source_type, ai_confidence, is_verified, content)
        ("initial_exam", "Первичный осмотр при поступлении", -28, DOCTOR_ID,
         "manual", None, True,
         {"complaints": "Внезапная слабость в правой руке, нарушение речи, головокружение",
          "anamnesis": "Симптомы развились остро 3 часа назад. АГ в анамнезе ~5 лет, нерегулярный приём препаратов.",
          "objective": "АД 180/100, ЧСС 92, t 36.8. Правосторонний гемипарез, моторная афазия.",
          "plan": "Экстренная КТ, тромболизис при отсутствии противопоказаний"}),
        ("daily_note", "Дневник. День 1", -27, DOCTOR_ID,
         "manual", None, True,
         {"status": "Стабильный", "complaints": "Головная боль, слабость в правых конечностях",
          "vitals": "АД 155/92, пульс 88, t 37.1",
          "plan": "Продолжить антикоагулянтную терапию, мониторинг"}),
        ("daily_note", "Дневник. День 3", -25, DOCTOR_ID,
         "manual", None, True,
         {"status": "Положительная динамика", "complaints": "Слабость уменьшилась",
          "vitals": "АД 145/88, пульс 80, t 36.7",
          "plan": "Начать раннюю реабилитацию, ЛФК в постели"}),
        ("specialist_consult", "Консультация невролога", -14, DOCTOR_NURLAN_ID,
         "manual", None, True,
         {"specialist": "Невролог Жумабеков Н.",
          "findings": "NIHSS 10 (снижение с 18). Правосторонний гемипарез: рука 2/5, нога 3/5. Моторная афазия умеренной степени.",
          "recommendations": "Усилить ЛФК, добавить логопедические занятия, контрольное МРТ через 2 недели"}),
        ("procedure_note", "КТ головного мозга", -28, DOCTOR_ID,
         "manual", None, True,
         {"procedure": "КТ головного мозга без контраста",
          "findings": "Очаг ишемии в бассейне левой СМА, размер ~2.5×1.8 см",
          "conclusion": "Ишемический инсульт, показания к тромболизису"}),
        ("procedure_note", "МРТ головного мозга (контроль)", -14, DOCTOR_ID,
         "manual", None, True,
         {"procedure": "МРТ головного мозга",
          "findings": "Зона инфаркта стабилизирована, перифокальный отёк уменьшился",
          "conclusion": "Положительная динамика. Рекомендовано продолжить реабилитацию."}),
        ("lab_interpretation", "Интерпретация ОАК и биохимии", -21, DOCTOR_ID,
         "manual", None, True,
         {"tests": "ОАК, биохимия крови, коагулограмма",
          "key_findings": "Гемоглобин 105 г/Л (снижен). Глюкоза натощак 9.1 ммоль/Л (повышена). Холестерин 7.2 ммоль/Л (повышен).",
          "interpretation": "Анемия лёгкой степени. Впервые выявленный СД 2 типа. Гиперхолестеринемия.",
          "actions": "Аторвастатин 40 мг, диетотерапия, контроль глюкозы"}),
        ("ai_generated", "AI: Сводка за неделю 2", -14, DOCTOR_ID,
         "ai_generated", 0.87, False,
         {"summary": "За прошедшую неделю отмечается стабильная положительная динамика. АД снизилось до 140/85 мм рт.ст. NIHSS улучшился с 14 до 10 баллов. Пациент активно участвует в реабилитации.",
          "risks": ["Повышенная глюкоза — необходим контроль", "Анемия лёгкой степени — наблюдение"],
          "recommendations": ["Контроль ОАК через 7 дней", "Консультация эндокринолога"]}),
        ("ai_generated", "AI: Анализ трендов витальных показателей", -7, DOCTOR_ID,
         "ai_generated", 0.92, True,
         {"analysis": "Тренд АД: стабильное снижение с 180/100 до 130/82. Пульс нормализовался (72 уд/мин). SpO2 стабильно 97-98%.",
          "positive_trends": ["Артериальное давление", "Частота сердечных сокращений", "Сатурация"],
          "concerning_trends": ["Глюкоза крови — незначительное повышение"],
          "confidence": 0.92}),
        ("daily_note", "Дневник. День 21", -7, DOCTOR_ID,
         "manual", None, True,
         {"status": "Улучшение", "complaints": "Минимальные — лёгкая слабость в правой руке",
          "vitals": "АД 130/82, пульс 72, t 36.6, SpO2 98%",
          "plan": "Продолжить ЛФК активный этап. Контроль лабораторных через 7 дней."}),
        ("daily_note", "Дневник. День 25", -3, NURSE_GULZAT_ID,
         "manual", None, True,
         {"status": "Стабильный", "complaints": "Пациент активен, занимается ЛФК самостоятельно",
          "vitals": "АД 128/80, пульс 70, t 36.5",
          "plan": "Подготовка к выписке. Обучение самоконтролю АД."}),
        ("ai_generated", "AI: Оценка рисков перед выпиской", -2, DOCTOR_ID,
         "ai_generated", 0.89, False,
         {"risk_assessment": "Общий риск повторного инсульта — умеренный. Модифицируемые факторы: АГ (контролируется), гиперхолестеринемия (на терапии), СД 2 типа (диета).",
          "discharge_readiness": "Пациент готов к выписке с амбулаторным наблюдением",
          "follow_up": ["Осмотр невролога через 2 недели", "Контроль ОАК + биохимия через 1 месяц", "МРТ контроль через 3 месяца"]}),
    ]

    added = 0
    for (etype, title, days, author_id, source, ai_conf, verified, content) in entries:
        recorded_at = ts(days, hour=10, minute=30)
        await conn.execute(
            """
            INSERT INTO medical_history_entries
                (id, clinic_id, patient_id, entry_type, title,
                 recorded_at, author_id, is_verified,
                 source_type, ai_confidence, content,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::historyentrytype, $5,
                 $6, $7, $8,
                 $9::sourcetype, $10, $11::jsonb,
                 false, $12, $12)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            etype, title,
            recorded_at, uuid.UUID(author_id), verified,
            source, ai_conf, json.dumps(content, ensure_ascii=False),
            now,
        )
        added += 1
    print(f"   -> {added} medical history entries added")


# ---------------------------------------------------------------------------
# 8. Treatment Plans — 2 plans with items
# ---------------------------------------------------------------------------
async def seed_treatment_plans(conn: asyncpg.Connection):
    print("8. Seeding treatment plans ...")

    plan1_id = uuid.uuid4()
    plan2_id = uuid.uuid4()

    plans = [
        (plan1_id, "Программа реабилитации после ишемического инсульта",
         "Комплексная 60-дневная программа: медикаментозная терапия, ЛФК, нейрореабилитация.",
         "ACTIVE", date.today() - timedelta(days=28), date.today() + timedelta(days=32)),
        (plan2_id, "Контроль метаболических факторов риска",
         "Коррекция гиперхолестеринемии и гипергликемии. Диетотерапия.",
         "ACTIVE", date.today() - timedelta(days=21), date.today() + timedelta(days=69)),
    ]

    for pid, title, desc, status, start_d, end_d in plans:
        await conn.execute(
            """
            INSERT INTO treatment_plans
                (id, clinic_id, patient_id, doctor_id, title, description,
                 status, start_date, end_date,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6,
                 $7::treatmentplanstatus, $8, $9,
                 false, $10, $10)
            """,
            pid, uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            uuid.UUID(DOCTOR_ID), title, desc,
            status, start_d, end_d, now,
        )

    # Plan 1 items (rehab)
    items_plan1 = [
        ("MEDICATION", "Аспирин 100 мг — антиагрегант", "COMPLETED", -28, 1),
        ("MEDICATION", "Аторвастатин 40 мг — гиполипидемия", "IN_PROGRESS", -21, 2),
        ("PROCEDURE", "КТ головного мозга (при поступлении)", "COMPLETED", -28, 3),
        ("PROCEDURE", "МРТ головного мозга (контрольное)", "COMPLETED", -14, 4),
        ("LAB_TEST", "ОАК + биохимия (базовый)", "COMPLETED", -28, 5),
        ("LAB_TEST", "Контрольный ОАК + СРБ + глюкоза", "COMPLETED", -7, 6),
        ("THERAPY", "Логопедические занятия (2x/неделю)", "IN_PROGRESS", -25, 7),
        ("EXERCISE", "ЛФК — начальный этап (нед. 1-2)", "COMPLETED", -26, 8),
        ("EXERCISE", "ЛФК — активный этап (нед. 3-5)", "IN_PROGRESS", -14, 9),
        ("THERAPY", "Физиотерапия — НМЭС (10 сеансов)", "IN_PROGRESS", -10, 10),
        ("LAB_TEST", "Контрольный ОАК + биохимия (день 60)", "PENDING", 32, 11),
        ("MONITORING", "Суточное мониторирование АД", "CANCELLED", -20, 12),
    ]

    for itype, title, status, days, sort in items_plan1:
        scheduled = ts(days, hour=9)
        await conn.execute(
            """
            INSERT INTO treatment_plan_items
                (id, clinic_id, treatment_plan_id, item_type, title,
                 status, scheduled_at, sort_order, assigned_to_id,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::treatmentitemtype, $5,
                 $6::treatmentitemstatus, $7, $8, $9,
                 false, $10, $10)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), plan1_id,
            itype, title,
            status, scheduled, sort, uuid.UUID(DOCTOR_ID),
            now,
        )

    # Plan 2 items (metabolic)
    items_plan2 = [
        ("MEDICATION", "Метформин 500 мг (при подтверждении СД)", "PENDING", -7, 1),
        ("DIET", "Средиземноморская диета — консультация диетолога", "IN_PROGRESS", -14, 2),
        ("MONITORING", "Ежедневный контроль глюкозы (глюкометр)", "IN_PROGRESS", -21, 3),
        ("LAB_TEST", "HbA1c (гликированный гемоглобин)", "PENDING", 14, 4),
    ]

    for itype, title, status, days, sort in items_plan2:
        scheduled = ts(days, hour=9)
        await conn.execute(
            """
            INSERT INTO treatment_plan_items
                (id, clinic_id, treatment_plan_id, item_type, title,
                 status, scheduled_at, sort_order, assigned_to_id,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::treatmentitemtype, $5,
                 $6::treatmentitemstatus, $7, $8, $9,
                 false, $10, $10)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), plan2_id,
            itype, title,
            status, scheduled, sort, uuid.UUID(DOCTOR_ID),
            now,
        )

    print(f"   -> 2 treatment plans + {len(items_plan1) + len(items_plan2)} items added")


# ---------------------------------------------------------------------------
# 9. Lab Results — 15 results
# ---------------------------------------------------------------------------
async def seed_lab_results(conn: asyncpg.Connection):
    print("9. Seeding lab orders & results ...")

    lab_specs = [
        # (test_id, label, unit, ref_range, start_val, end_val, hi_threshold)
        (LAB_HEMOGLOBIN_ID, "Гемоглобин", "г/Л", "120-160", 95.0, 125.0, 120.0),
        (LAB_BIOCHEM_ID, "Лейкоциты", "×10⁹/Л", "4.0-10.0", 15.2, 7.8, 10.0),
        (LAB_CRP_ID, "СРБ", "мг/Л", "0-5", 85.0, 3.2, 5.0),
        (LAB_GLUCOSE_ID, "Глюкоза", "ммоль/Л", "3.9-6.1", 9.1, 5.4, 6.1),
        (LAB_CHOLESTEROL_ID, "Холестерин", "ммоль/Л", "3.0-5.2", 7.2, 5.1, 5.2),
    ]

    time_points = [(-28, "URGENT"), (-14, "ROUTINE"), (-3, "ROUTINE")]
    added = 0

    for test_id, label, unit, ref_range, start_val, end_val, hi_threshold in lab_specs:
        for tp_idx, (day_offset, priority) in enumerate(time_points):
            t = tp_idx / (len(time_points) - 1)
            value = round(jitter(lerp(start_val, end_val, t), 0.02), 2)
            ordered_ts = ts(day_offset, hour=9)
            collected_ts = ordered_ts + timedelta(hours=1)
            resulted_ts = ordered_ts + timedelta(hours=random.randint(4, 24))
            is_abnormal = value > hi_threshold or (label == "Гемоглобин" and value < 120)

            order_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO lab_orders
                    (id, clinic_id, patient_id, ordered_by_id, test_id,
                     priority, status, collected_at,
                     is_deleted, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5,
                     $6::laborderpriority, $7::laborderstatus, $8,
                     false, $9, $9)
                """,
                order_id, uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
                uuid.UUID(DOCTOR_ID), uuid.UUID(test_id),
                priority, "COMPLETED", collected_ts,
                ordered_ts,
            )

            await conn.execute(
                """
                INSERT INTO lab_results
                    (id, clinic_id, lab_order_id, value, numeric_value,
                     unit, reference_range, is_abnormal, visible_to_patient,
                     status, resulted_at,
                     is_deleted, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4, $5,
                     $6, $7, $8, $9,
                     $10::labresultstatus, $11,
                     false, $12, $12)
                """,
                uuid.uuid4(), uuid.UUID(CLINIC_ID), order_id,
                str(value), value,
                unit, ref_range, is_abnormal, True,
                "FINAL", resulted_ts,
                now,
            )
            added += 1

    print(f"   -> {added} lab orders + results added")


# ---------------------------------------------------------------------------
# 10. Appointments — 10 records
# ---------------------------------------------------------------------------
async def seed_appointments(conn: asyncpg.Connection):
    print("10. Seeding appointments ...")

    schedule = [
        # (days_from_now, hour, minute, type, status, patient_id, doctor_id, reason, notes)
        (-25, 9, 0, "CONSULTATION", "COMPLETED", PATIENT_ID, DOCTOR_ID,
         "Экстренная консультация — инсульт", "Тромболизис проведён успешно"),
        (-18, 10, 0, "FOLLOW_UP", "COMPLETED", PATIENT_ID, DOCTOR_ID,
         "Контрольный осмотр после инсульта", "Динамика положительная"),
        (-14, 14, 0, "CONSULTATION", "COMPLETED", PATIENT_ID, DOCTOR_NURLAN_ID,
         "Консультация невролога", "NIHSS 10, рекомендации по ЛФК"),
        (-7, 9, 30, "FOLLOW_UP", "COMPLETED", PATIENT_ID, DOCTOR_ID,
         "Плановый осмотр — неделя 3", "Глюкоза повышена"),
        (-3, 11, 0, "PROCEDURE", "COMPLETED", PATIENT_ID, DOCTOR_ERMEK_ID,
         "Физиотерапия НМЭС", "Сеанс 8 из 10"),
        (-1, 10, 0, "FOLLOW_UP", "CANCELLED", PATIENT_ID, DOCTOR_ID,
         "Контроль АД — отменён по просьбе пациента", None),
        (2, 9, 0, "FOLLOW_UP", "SCHEDULED", PATIENT_ID, DOCTOR_ID,
         "Плановый осмотр — неделя 5", None),
        (5, 14, 0, "TELEMEDICINE", "SCHEDULED", PATIENT_ID, DOCTOR_ID,
         "Телемедицинская консультация — обсуждение выписки", None),
        (3, 10, 0, "CONSULTATION", "SCHEDULED", PATIENT_BERMET_ID, DOCTOR_NURLAN_ID,
         "Первичная консультация невролога", None),
        (4, 11, 30, "FOLLOW_UP", "CONFIRMED", PATIENT_KANAT_ID, DOCTOR_ERMEK_ID,
         "Контроль АД и холестерина", None),
    ]

    added = 0
    for (days, hour, minute, atype, status, pat_id, doc_id, reason, notes) in schedule:
        start_dt = ts(days, hour=hour, minute=minute)
        end_dt = start_dt + timedelta(minutes=30)
        actual_start = start_dt if status == "COMPLETED" else None
        actual_end = end_dt if status == "COMPLETED" else None

        await conn.execute(
            """
            INSERT INTO appointments
                (id, clinic_id, patient_id, doctor_id,
                 appointment_type, status,
                 scheduled_start, scheduled_end,
                 actual_start, actual_end,
                 reason, notes, is_walk_in,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4,
                 $5::appointmenttype, $6::appointmentstatus,
                 $7, $8,
                 $9, $10,
                 $11, $12, false,
                 false, $13, $13)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID),
            uuid.UUID(pat_id), uuid.UUID(doc_id),
            atype, status,
            start_dt, end_dt,
            actual_start, actual_end,
            reason, notes, now,
        )
        added += 1
    print(f"   -> {added} appointments added")


# ---------------------------------------------------------------------------
# 11. Documents — 6 documents
# ---------------------------------------------------------------------------
async def seed_documents(conn: asyncpg.Connection):
    print("11. Seeding documents ...")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    documents = [
        ("КТ головного мозга — снимок", "imaging", "ct-brain-prod.txt",
         "text/plain", "КТ при поступлении, очаг ишемии в бассейне левой СМА",
         -28, DOCTOR_ID,
         "КТ ГОЛОВНОГО МОЗГА\nЗАКЛЮЧЕНИЕ: Очаг ишемии в бассейне левой СМА, ~2.5×1.8 см."),
        ("МРТ головного мозга — контроль", "imaging", "mri-control-prod.txt",
         "text/plain", "Контрольное МРТ — положительная динамика",
         -14, DOCTOR_ID,
         "МРТ ГОЛОВНОГО МОЗГА (контроль)\nЗАКЛЮЧЕНИЕ: Зона инфаркта стабилизирована, отёк уменьшился."),
        ("Выписной эпикриз (черновик)", "discharge", "discharge-draft-prod.txt",
         "text/plain", "Черновик выписного эпикриза",
         -3, DOCTOR_ID,
         "ВЫПИСНОЙ ЭПИКРИЗ\nДИАГНОЗ: Ишемический инсульт (I63.0)\nЛЕЧЕНИЕ: Тромболизис, Аспирин, Аторвастатин, ЛФК."),
        ("Согласие на тромболизис", "consent", "consent-thrombolysis-prod.txt",
         "text/plain", "Информированное согласие на тромболитическую терапию",
         -28, ADMIN_ID,
         "ИНФОРМИРОВАННОЕ СОГЛАСИЕ на тромболизис.\nПациент: Уметов Асан Бакирович"),
        ("Направление на реабилитацию", "referral", "referral-rehab-prod.txt",
         "text/plain", "Направление в реабилитационный центр",
         -5, DOCTOR_ID,
         "НАПРАВЛЕНИЕ: Уметов А.Б. в реабилитационный центр «Саламат»\nЦЕЛЬ: Восстановление двигательных функций"),
        ("Полис ОМС (копия)", "insurance", "insurance-oms-prod.txt",
         "text/plain", "Копия полиса обязательного медицинского страхования",
         -28, ADMIN_ID,
         "ПОЛИС ОМС\nФИО: Уметов Асан Бакирович\nНомер: КР-ОМС 0012345678"),
    ]

    added = 0
    for title, category, fname, mime, desc, days, uploader, content in documents:
        file_path = os.path.join(UPLOAD_DIR, fname)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        file_size = os.path.getsize(file_path)
        file_url = f"/uploads/{fname}"
        uploaded_at = ts(days, hour=11)

        await conn.execute(
            """
            INSERT INTO documents
                (id, clinic_id, patient_id, title, category, file_url, file_name,
                 file_size, mime_type, description, uploaded_by_id, uploaded_at,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5::documentcategory, $6, $7,
                 $8, $9, $10, $11, $12,
                 false, $13, $13)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            title, category, file_url, fname,
            file_size, mime, desc, uuid.UUID(uploader), uploaded_at,
            now,
        )
        added += 1
    print(f"   -> {added} documents added")


# ---------------------------------------------------------------------------
# 12. Telemedicine Sessions — 3 sessions with messages
# ---------------------------------------------------------------------------
async def seed_telemedicine(conn: asyncpg.Connection):
    print("12. Seeding telemedicine sessions ...")

    sessions = [
        (uid(), f"room-prod-{uuid.uuid4().hex[:8]}", "COMPLETED",
         ts(-20, 10, 0), ts(-20, 10, 45), 45 * 60,
         "Пациент демонстрирует положительную динамику. Восстановление руки ~45%. Дизартрия снизилась."),
        (uid(), f"room-prod-{uuid.uuid4().hex[:8]}", "COMPLETED",
         ts(-10, 14, 0), ts(-10, 14, 20), 20 * 60,
         "АД 135/85 — хорошая динамика. Аторвастатин повышен до 40 мг."),
        (uid(), f"room-prod-{uuid.uuid4().hex[:8]}", "WAITING",
         None, None, None, None),
    ]

    added = 0
    for sid, room_id, status, started, ended, duration, notes in sessions:
        created = started or ts(5, 9)
        await conn.execute(
            """
            INSERT INTO telemedicine_sessions
                (id, clinic_id, patient_id, doctor_id, room_id, status,
                 started_at, ended_at, duration_seconds, doctor_notes,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6::telemedicinesessionstatus,
                 $7, $8, $9, $10,
                 false, $11, $11)
            """,
            uuid.UUID(sid), uuid.UUID(CLINIC_ID),
            uuid.UUID(PATIENT_ID), uuid.UUID(DOCTOR_ID),
            room_id, status,
            started, ended, duration, notes,
            created,
        )
        added += 1
    print(f"   -> {added} telemedicine sessions added")


# ---------------------------------------------------------------------------
# 13. Messages — 8 messages
# ---------------------------------------------------------------------------
async def seed_messages(conn: asyncpg.Connection):
    print("13. Seeding messages ...")

    messages = [
        (DOCTOR_ID, ADMIN_ID, PATIENT_ID,
         "Добрый день, Асан! Как себя чувствуете? Расскажите о самочувствии.",
         ts(-20, 10, 2), True),
        (ADMIN_ID, DOCTOR_ID, PATIENT_ID,
         "Здравствуйте, доктор. Чувствую себя лучше. Рука слабая, но упражнения делаю.",
         ts(-20, 10, 3), True),
        (DOCTOR_ID, ADMIN_ID, PATIENT_ID,
         "Отлично! Продолжайте. Я добавлю интенсивные упражнения на следующей неделе.",
         ts(-20, 10, 15), True),
        (DOCTOR_ID, ADMIN_ID, PATIENT_ID,
         "Асан, результаты анализов: холестерин 5.1 — хорошая динамика. Продолжаем Аторвастатин.",
         ts(-10, 14, 3), True),
        (ADMIN_ID, DOCTOR_ID, PATIENT_ID,
         "Понял, доктор. Давление 135/85, это нормально?",
         ts(-10, 14, 6), True),
        (DOCTOR_ID, ADMIN_ID, PATIENT_ID,
         "Да, 135/85 — хорошая динамика (было 160/95). Продолжайте контролировать ежедневно.",
         ts(-10, 14, 8), True),
        (DOCTOR_ID, ADMIN_ID, PATIENT_ID,
         "Напоминаю: завтра контрольный осмотр в 9:00. Не забудьте измерить АД утром.",
         ts(-2, 16, 0), False),
        (ADMIN_ID, DOCTOR_ID, PATIENT_ID,
         "Хорошо, доктор. Буду. Спасибо!",
         ts(-2, 16, 15), True),
    ]

    added = 0
    for sender, recipient, patient, content, sent_at, is_read in messages:
        await conn.execute(
            """
            INSERT INTO messages
                (id, clinic_id, sender_id, recipient_id, patient_id,
                 content, is_read,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5,
                 $6, $7,
                 false, $8, $8)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID),
            uuid.UUID(sender), uuid.UUID(recipient), uuid.UUID(patient),
            content, is_read,
            sent_at,
        )
        added += 1
    print(f"   -> {added} messages added")


# ---------------------------------------------------------------------------
# 14. Notifications — 10 for admin/doctor
# ---------------------------------------------------------------------------
async def seed_notifications(conn: asyncpg.Connection):
    print("14. Seeding notifications ...")

    notifications = [
        # (user_id, type, title, message, severity, is_read, days_ago, ref_type, data)
        (DOCTOR_ID, "PATIENT_ASSIGNED", "Новый пациент назначен",
         "Вам назначен пациент Уметов Асан Бакирович (экстренная госпитализация)",
         "INFO", True, -28, "Patient", {"patient_name": "Уметов Асан"}),
        (DOCTOR_ID, "ABNORMAL_RESULT", "Критический результат лабораторного анализа",
         "СРБ: 85.0 мг/Л (норма 0-5). Пациент: Уметов Асан",
         "CRITICAL", True, -27, "LabResult", {"test": "СРБ", "value": 85.0}),
        (DOCTOR_ID, "LAB_RESULT_READY", "Результаты анализов готовы",
         "ОАК + биохимия для пациента Уметов Асан — результаты доступны",
         "INFO", True, -21, "LabResult", None),
        (ADMIN_ID, "SYSTEM", "Новая регистрация",
         "Зарегистрирован новый пациент: Сыдыкова Бермет Канатовна",
         "INFO", True, -20, "Patient", None),
        (DOCTOR_ID, "TREATMENT_UPDATED", "План лечения обновлён",
         "План реабилитации пациента Уметов Асан обновлён: добавлены ЛФК упражнения",
         "INFO", True, -14, "TreatmentPlan", None),
        (DOCTOR_ID, "APPOINTMENT_REMINDER", "Напоминание о приёме",
         "Завтра в 9:00 — контрольный осмотр пациента Уметов Асан",
         "WARNING", False, -1, "Appointment", None),
        (DOCTOR_ID, "ABNORMAL_RESULT", "Повышенная глюкоза",
         "Глюкоза: 7.2 ммоль/Л (норма 3.9-6.1). Пациент: Уметов Асан",
         "WARNING", True, -7, "LabResult", {"test": "Глюкоза", "value": 7.2}),
        (ADMIN_ID, "SYSTEM", "Обновление системы",
         "Запланировано техническое обслуживание сервера: 20 апреля 02:00-04:00",
         "INFO", False, -2, None, None),
        (DOCTOR_ID, "LAB_RESULT_READY", "Контрольные анализы готовы",
         "Контрольный ОАК + СРБ + глюкоза — результаты загружены",
         "INFO", False, -3, "LabResult", None),
        (DOCTOR_ID, "MEDICATION_DUE", "Проверка назначений",
         "Аспирин 100 мг для Уметов А.Б. — подходит срок контроля эффективности",
         "INFO", False, -1, "Medication", None),
    ]

    added = 0
    for (user_id, ntype, title, message, severity, is_read,
         days, ref_type, data) in notifications:
        created_at = ts(days, hour=8, minute=30)
        read_at_val = created_at + timedelta(hours=1) if is_read else None
        await conn.execute(
            """
            INSERT INTO notifications
                (id, clinic_id, user_id, type, title, message,
                 severity, is_read, read_at,
                 reference_type, data,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::notificationtype, $5, $6,
                 $7::notificationseverity, $8, $9,
                 $10, $11::jsonb,
                 false, $12, $12)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(user_id),
            ntype, title, message,
            severity, is_read, read_at_val,
            ref_type, json.dumps(data, ensure_ascii=False) if data else None,
            created_at,
        )
        added += 1
    print(f"   -> {added} notifications added")


# ---------------------------------------------------------------------------
# 15. Audit Logs — 20 entries
# ---------------------------------------------------------------------------
async def seed_audit_logs(conn: asyncpg.Connection):
    print("15. Seeding audit logs ...")

    logs = [
        (-58, ADMIN_ID, "patient_created", "Patient", PATIENT_ID,
         None, {"first_name": "Асан", "last_name": "Уметов", "status": "ACTIVE"}, "192.168.1.10"),
        (-58, ADMIN_ID, "document_uploaded", "Document", uid(),
         None, {"title": "Согласие на тромболизис", "category": "consent"}, "192.168.1.10"),
        (-55, DOCTOR_ID, "diagnosis_added", "Patient", PATIENT_ID,
         None, {"icd_code": "I63.0", "description": "Ишемический инсульт"}, "192.168.1.22"),
        (-55, DOCTOR_ID, "document_uploaded", "Document", uid(),
         None, {"title": "КТ головного мозга", "category": "imaging"}, "192.168.1.22"),
        (-50, ADMIN_ID, "patient_updated", "Patient", PATIENT_ID,
         {"phone": "+996 555 100000"}, {"phone": "+996 700 123456"}, "192.168.1.10"),
        (-45, DOCTOR_ID, "prescription_created", "Medication", uid(),
         None, {"drug_name": "Аспирин 100 мг", "frequency": "1x/день"}, "192.168.1.22"),
        (-40, DOCTOR_ID, "procedure_ordered", "Procedure", uid(),
         None, {"name": "МРТ головного мозга контрольное", "priority": "ROUTINE"}, "192.168.1.22"),
        (-35, ADMIN_ID, "room_transfer", "Patient", PATIENT_ID,
         {"room": "Палата 101", "bed": "101-2"}, {"room": "Палата 201", "bed": "201-1"}, "192.168.1.10"),
        (-30, DOCTOR_ID, "lab_result_approved", "LabResult", uid(),
         {"status": "PENDING"}, {"status": "FINAL", "value": "95.0 г/Л"}, "192.168.1.22"),
        (-28, DOCTOR_NURLAN_ID, "patient_viewed", "Patient", PATIENT_ID,
         None, {"action": "viewed_medical_card"}, "192.168.1.30"),
        (-25, DOCTOR_ID, "prescription_created", "Medication", uid(),
         None, {"drug_name": "Аторвастатин 40 мг", "frequency": "1x/день вечером"}, "192.168.1.22"),
        (-22, DOCTOR_ID, "treatment_plan_created", "TreatmentPlan", uid(),
         None, {"title": "Программа реабилитации", "status": "ACTIVE"}, "192.168.1.22"),
        (-20, ADMIN_ID, "portal_password_reset", "User", ADMIN_ID,
         None, {"action": "password_reset_email_sent"}, "10.0.0.5"),
        (-18, DOCTOR_ID, "document_uploaded", "Document", uid(),
         None, {"title": "МРТ контроль", "category": "imaging"}, "192.168.1.22"),
        (-15, DOCTOR_ID, "lab_result_approved", "LabResult", uid(),
         {"status": "PENDING"}, {"status": "FINAL", "value": "5.1 ммоль/Л"}, "192.168.1.22"),
        (-10, ADMIN_ID, "document_uploaded", "Document", uid(),
         None, {"title": "Направление на реабилитацию", "category": "referral"}, "192.168.1.10"),
        (-7, DOCTOR_ID, "diagnosis_added", "Patient", PATIENT_ID,
         None, {"icd_code": "E11.9", "description": "СД 2 типа"}, "192.168.1.22"),
        (-5, DOCTOR_ID, "document_uploaded", "Document", uid(),
         None, {"title": "Выписной эпикриз (черновик)", "category": "discharge"}, "192.168.1.22"),
        (-3, ADMIN_ID, "patient_updated", "Patient", PATIENT_ID,
         {"notes": None}, {"notes": "Подготовка к выписке"}, "192.168.1.10"),
        (-1, DOCTOR_ID, "procedure_ordered", "Procedure", uid(),
         None, {"name": "Контрольный ОАК + СРБ", "priority": "ROUTINE"}, "192.168.1.22"),
    ]

    added = 0
    for (days, user_id, action, res_type, res_id, old_vals, new_vals, ip) in logs:
        log_ts = ts(days, hour=11, minute=30)
        # resource_id must be a valid UUID
        try:
            resource_uuid = uuid.UUID(res_id)
        except (ValueError, AttributeError):
            resource_uuid = uuid.uuid4()

        await conn.execute(
            """
            INSERT INTO audit_logs
                (id, clinic_id, user_id, action, resource_type, resource_id,
                 old_values, new_values, ip_address,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6,
                 $7::jsonb, $8::jsonb, $9,
                 false, $10, $10)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(user_id),
            action, res_type, resource_uuid,
            json.dumps(old_vals, ensure_ascii=False) if old_vals else None,
            json.dumps(new_vals, ensure_ascii=False) if new_vals else None,
            ip, log_ts,
        )
        added += 1
    print(f"   -> {added} audit log entries added")


# ---------------------------------------------------------------------------
# 16. Recovery Goals — 5 goals + domain weights
# ---------------------------------------------------------------------------
async def seed_recovery_goals(conn: asyncpg.Connection):
    print("16. Seeding recovery goals & domain weights ...")

    goals = [
        ("VITALS", "systolic_bp", 130.0),
        ("VITALS", "pulse", 72.0),
        ("VITALS", "blood_glucose", 5.5),
        ("LABS", "hemoglobin", 140.0),
        ("LABS", "cholesterol", 5.0),
    ]

    added = 0
    for domain, metric_key, target_value in goals:
        await conn.execute(
            """
            INSERT INTO recovery_goals
                (id, clinic_id, patient_id, domain, metric_key, target_value, set_by_id,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::recoverydomain, $5, $6, $7,
                 false, $8, $8)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            domain, metric_key, target_value, uuid.UUID(DOCTOR_ID),
            now,
        )
        added += 1

    # Domain weights
    weights = [
        ("VITALS", 0.30),
        ("LABS", 0.20),
        ("SCALES", 0.20),
        ("EXERCISES", 0.15),
        ("TREATMENT", 0.15),
    ]
    for domain, weight in weights:
        await conn.execute(
            """
            INSERT INTO recovery_domain_weights
                (id, clinic_id, patient_id, domain, weight, set_by_id,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::recoverydomain, $5, $6,
                 false, $7, $7)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            domain, weight, uuid.UUID(DOCTOR_ID), now,
        )

    print(f"   -> {added} recovery goals + {len(weights)} domain weights added")


# ---------------------------------------------------------------------------
# 17. Stroke Assessments — NIHSS, MRS, Barthel, MMSE (improving trend)
# ---------------------------------------------------------------------------
async def seed_stroke_assessments(conn: asyncpg.Connection):
    print("17. Seeding stroke assessments ...")

    assessment_schedules = [
        # (type, max_score, [scores], [days_ago], [interpretations])
        ("NIHSS", 42,
         [18, 14, 10, 7, 4, 2],
         [-28, -21, -14, -7, -3, -1],
         ["Умеренно-тяжёлый инсульт", "Умеренный инсульт", "Умеренный инсульт",
          "Лёгкий инсульт", "Лёгкий инсульт", "Минимальный дефицит"]),
        ("MRS", 6,
         [4, 3, 2, 2, 1],
         [-28, -21, -14, -7, -1],
         ["Умеренно тяжёлая инвалидность", "Умеренная инвалидность",
          "Лёгкая инвалидность", "Лёгкая инвалидность", "Незначительные симптомы"]),
        ("BARTHEL", 100,
         [30, 50, 65, 80, 90],
         [-28, -21, -14, -7, -1],
         ["Выраженная зависимость", "Умеренная зависимость",
          "Умеренная зависимость", "Лёгкая зависимость", "Почти независимость"]),
        ("MMSE", 30,
         [20, 23, 25, 27, 28],
         [-28, -21, -14, -7, -1],
         ["Умеренное когнитивное снижение", "Лёгкое когнитивное снижение",
          "Лёгкое когнитивное снижение", "Норма", "Норма"]),
    ]

    added = 0
    for atype, max_score, scores, days_list, interpretations in assessment_schedules:
        for score, days, interp in zip(scores, days_list, interpretations):
            assessed_at = ts(days, hour=10)
            await conn.execute(
                """
                INSERT INTO stroke_assessments
                    (id, clinic_id, patient_id, assessed_by_id,
                     assessment_type, score, max_score,
                     assessed_at, interpretation,
                     is_deleted, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4,
                     $5::assessmenttype, $6, $7,
                     $8, $9,
                     false, $10, $10)
                """,
                uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
                uuid.UUID(DOCTOR_ID),
                atype, score, max_score,
                assessed_at, interp,
                now,
            )
            added += 1
    print(f"   -> {added} stroke assessments added")


# ---------------------------------------------------------------------------
# 18. Exercise Sessions — 15 sessions using existing catalog
# ---------------------------------------------------------------------------
async def seed_exercise_sessions(conn: asyncpg.Connection):
    print("18. Seeding exercise sessions ...")

    # Verify at least one exercise exists
    ex_exists = await conn.fetchval(
        "SELECT 1 FROM exercises WHERE id = $1",
        uuid.UUID(EXERCISE_IDS[0]),
    )
    if not ex_exists:
        print("   -> SKIPPED (exercise catalog not found in DB)")
        return

    session_days = sorted(random.sample(range(1, 29), 15))
    added = 0

    for rank, day in enumerate(session_days):
        t = rank / (len(session_days) - 1)
        ex_id = EXERCISE_IDS[rank % len(EXERCISE_IDS)]
        started = ts(-day, hour=random.randint(9, 16))
        duration = int(jitter(lerp(300, 900, t), 0.08))
        completed = started + timedelta(seconds=duration)

        await conn.execute(
            """
            INSERT INTO exercise_sessions
                (id, clinic_id, patient_id, exercise_id,
                 duration_seconds, reps_completed, sets_completed,
                 accuracy_score, started_at, completed_at,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4,
                 $5, $6, $7,
                 $8, $9, $10,
                 false, $11, $11)
            """,
            uuid.uuid4(), uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            uuid.UUID(ex_id),
            duration,
            int(jitter(lerp(5, 15, t), 0.1)),
            max(1, int(lerp(1, 3, t))),
            round(min(100, jitter(lerp(40, 85, t), 0.06)), 2),
            started, completed,
            now,
        )
        added += 1
    print(f"   -> {added} exercise sessions added")


# ---------------------------------------------------------------------------
# 19. Rehab Goals (from stroke model) — 5 goals with progress
# ---------------------------------------------------------------------------
async def seed_rehab_goals(conn: asyncpg.Connection):
    print("19. Seeding rehab goals with progress ...")

    goals = [
        # (domain, description, target_date_offset, baseline, target, current, status)
        ("MOBILITY", "Восстановление двигательной функции правой руки до 4/5",
         60, "2/5", "4/5", "3/5", "ACTIVE"),
        ("MOBILITY", "Самостоятельная ходьба без поддержки",
         45, "Ходьба с поддержкой", "Самостоятельная ходьба", "Ходьба с тростью", "PARTIALLY_ACHIEVED"),
        ("SPEECH", "Восстановление экспрессивной речи до функционального уровня",
         90, "Выраженная моторная афазия", "Функциональная речь", "Умеренная дизартрия", "ACTIVE"),
        ("COGNITION", "MMSE >= 27 баллов",
         60, "20", "27", "28", "ACHIEVED"),
        ("ADL", "Независимость в повседневной деятельности (Barthel >= 85)",
         45, "30", "85", "90", "ACHIEVED"),
    ]

    added = 0
    for domain, desc, offset, baseline, target, current, status in goals:
        goal_id = uuid.uuid4()
        target_date = (date.today() - timedelta(days=28) + timedelta(days=offset))
        await conn.execute(
            """
            INSERT INTO rehab_goals
                (id, clinic_id, patient_id, domain, description,
                 target_date, baseline_value, target_value, current_value,
                 status, set_by_id,
                 is_deleted, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4::rehabdomain, $5,
                 $6, $7, $8, $9,
                 $10::rehabgoalstatus, $11,
                 false, $12, $12)
            """,
            goal_id, uuid.UUID(CLINIC_ID), uuid.UUID(PATIENT_ID),
            domain, desc,
            target_date, baseline, target, current,
            status, uuid.UUID(DOCTOR_ID),
            now,
        )

        # Add 2-3 progress records per goal
        for p_idx in range(random.randint(2, 3)):
            days_ago = 28 - (p_idx * 10)
            if days_ago < 0:
                days_ago = 0
            await conn.execute(
                """
                INSERT INTO rehab_progress
                    (id, clinic_id, goal_id, recorded_by_id,
                     value, notes, recorded_at,
                     is_deleted, created_at, updated_at)
                VALUES
                    ($1, $2, $3, $4,
                     $5, $6, $7,
                     false, $8, $8)
                """,
                uuid.uuid4(), uuid.UUID(CLINIC_ID), goal_id,
                uuid.UUID(DOCTOR_ID),
                f"Прогресс: этап {p_idx + 1}",
                f"Контроль динамики {desc[:40]}",
                ts(-days_ago, hour=11),
                now,
            )
        added += 1
    print(f"   -> {added} rehab goals with progress records added")


# ===========================================================================
# Main
# ===========================================================================
async def main():
    print("=" * 60)
    print("Production Seed Script — Comprehensive Mock Data")
    print("Patient: Уметов Асан Бакирович")
    print("=" * 60)
    print()

    conn = await get_connection()

    try:
        # Idempotency check
        if await is_already_seeded(conn):
            print("Data already seeded (>= 6 visits for Уметов Асан). Skipping.")
            print("To re-seed, delete existing visits first:")
            print(f"  DELETE FROM visits WHERE patient_id = '{PATIENT_ID}';")
            return

        # First, check actual enum type names in PostgreSQL
        print("Checking PostgreSQL enum types ...")
        enum_types = await conn.fetch(
            "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname"
        )
        print(f"   Found enums: {[r['typname'] for r in enum_types]}")
        print()

        await seed_users(conn)
        await seed_patients(conn)
        await seed_medical_cards(conn)
        await seed_visits(conn)
        await seed_vital_signs(conn)
        await seed_diagnoses(conn)
        await seed_medical_history(conn)
        await seed_treatment_plans(conn)
        await seed_lab_results(conn)
        await seed_appointments(conn)
        await seed_documents(conn)
        await seed_telemedicine(conn)
        await seed_messages(conn)
        await seed_notifications(conn)
        await seed_audit_logs(conn)
        await seed_recovery_goals(conn)
        await seed_stroke_assessments(conn)
        await seed_exercise_sessions(conn)
        await seed_rehab_goals(conn)

        print()
        print("=" * 60)
        print("Verification counts:")
        print("=" * 60)
        tables = [
            "users", "patients", "medical_cards", "visits", "vital_signs",
            "diagnoses", "medical_history_entries", "treatment_plans",
            "treatment_plan_items", "lab_orders", "lab_results",
            "appointments", "documents", "telemedicine_sessions",
            "messages", "notifications", "audit_logs",
            "recovery_goals", "recovery_domain_weights",
            "stroke_assessments", "exercise_sessions",
            "rehab_goals", "rehab_progress",
        ]
        for tbl in tables:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {tbl}")
                print(f"   {tbl:<30}: {count}")
            except Exception:
                print(f"   {tbl:<30}: (table not found)")

        print()
        print("Production seed completed successfully!")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
