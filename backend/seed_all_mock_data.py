"""
Seed script: populate mock data for all empty features.

Features covered:
  1. Documents          (6 records + actual files in uploads/)
  2. Telemedicine       (4 sessions + 6 chat messages)
  3. Appointments       (+10 more for a busy 14-day schedule)
  4. Audit Logs         (15-20 entries spread over 60 days)
  5. Recovery Goals     (5 goals across VITALS / LABS domains)

Targets:
  Patient  : Асан Уметов  (22d1278e-cd6a-4bf4-8741-873f9fdca5af)
  Doctor   : Бакыт Исаков (b59f37e1-36a9-45b6-919b-20baee0a3ef4)
  Admin    : 88d553e7-ba10-4f13-91cd-8a7456105625
  Clinic   : ab676372-69fa-4af8-be33-91c1e307b4fc

Run:
  cd backend && .venv/bin/python seed_all_mock_data.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

PATIENT_ID = "22d1278e-cd6a-4bf4-8741-873f9fdca5af"
DOCTOR_ID  = "b59f37e1-36a9-45b6-919b-20baee0a3ef4"
ADMIN_ID   = "88d553e7-ba10-4f13-91cd-8a7456105625"
CLINIC_ID  = "ab676372-69fa-4af8-be33-91c1e307b4fc"

# Other patients / doctors discovered in the DB
OTHER_PATIENTS = [
    "28ce2f92-c62d-40c9-81f0-b86f3e0f3d0d",  # Бермет Сыдыкова
    "08ab7ffc-d364-44e1-9b84-45f9a6b539dd",  # Канат Жээнбеков
    "b4542b97-5c3e-431f-a7c1-9aecfa2c7c33",  # Динара Абдыкалыкова
    "f16f4f97-279d-4054-aeef-9887dbdca9f7",  # Эрмек Бообеков
]
OTHER_DOCTORS = [
    "b4e5b58d-cb09-47ae-b34d-b81d404b5c18",  # Нурлан Жумабеков
    "215e5428-76be-41eb-a21a-4ea1aaa1c4ee",  # Раимбеков Азамат
    "0fb5c65f-6616-4ee1-bbc5-e0d13f0b3459",  # Руслан Сейтбеков
]

now = datetime.now(timezone.utc)

# --------------------------------------------------------------------------- #
# Helper
# --------------------------------------------------------------------------- #
def ts(days_offset: int, hour: int = 10, minute: int = 0) -> datetime:
    """Return a timezone-aware datetime offset from today."""
    return datetime(now.year, now.month, now.day, hour, minute, 0,
                    tzinfo=timezone.utc) + timedelta(days=days_offset)


# --------------------------------------------------------------------------- #
# 1. DOCUMENTS
# --------------------------------------------------------------------------- #

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

DOCUMENTS = [
    {
        "id": str(uuid.uuid4()),
        "title": "КТ головного мозга — снимок",
        "category": "imaging",
        "file_name": "ct-brain.txt",
        "mime_type": "text/plain",
        "description": "КТ при поступлении, выявлен очаг ишемии в бассейне левой СМА",
        "days_offset": -55,
        "uploaded_by": DOCTOR_ID,
        "content": (
            "КТ ГОЛОВНОГО МОЗГА\n"
            "Дата исследования: " + (now + timedelta(days=-55)).strftime("%d.%m.%Y") + "\n"
            "Пациент: Уметов Асан Бакирович\n\n"
            "ЗАКЛЮЧЕНИЕ:\n"
            "Выявлен очаг ишемии в бассейне левой средней мозговой артерии.\n"
            "Размер очага: ~2.5 × 1.8 см. Смещения срединных структур нет.\n"
            "Рекомендовано: МРТ-контроль через 5-7 дней.\n"
        ),
    },
    {
        "id": str(uuid.uuid4()),
        "title": "МРТ головного мозга — контроль",
        "category": "imaging",
        "file_name": "mri-control.txt",
        "mime_type": "text/plain",
        "description": "Контрольное МРТ на 40-й день госпитализации",
        "days_offset": -18,
        "uploaded_by": DOCTOR_ID,
        "content": (
            "МРТ ГОЛОВНОГО МОЗГА (контрольное)\n"
            "Дата исследования: " + (now + timedelta(days=-18)).strftime("%d.%m.%Y") + "\n"
            "Пациент: Уметов Асан Бакирович\n\n"
            "ЗАКЛЮЧЕНИЕ:\n"
            "Ишемический очаг в бассейне левой СМА — динамика положительная.\n"
            "Зона инфаркта стабилизирована, перифокальный отёк значительно уменьшился.\n"
            "Рекомендовано: продолжить реабилитационную программу.\n"
        ),
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Выписной эпикриз (черновик)",
        "category": "discharge",
        "file_name": "discharge-draft.txt",
        "mime_type": "text/plain",
        "description": "Черновик выписного эпикриза — к подписанию",
        "days_offset": -5,
        "uploaded_by": DOCTOR_ID,
        "content": (
            "ВЫПИСНОЙ ЭПИКРИЗ (ЧЕРНОВИК)\n"
            "Дата: " + (now + timedelta(days=-5)).strftime("%d.%m.%Y") + "\n"
            "Пациент: Уметов Асан Бакирович, 1985 г.р.\n\n"
            "ДИАГНОЗ: Ишемический инсульт в бассейне левой СМА (I63.3)\n\n"
            "ПРОВЕДЁННОЕ ЛЕЧЕНИЕ:\n"
            "- Аспирин 100 мг/сут — антиагрегантная терапия\n"
            "- Аторвастатин 40 мг/сут — гиполипидемия\n"
            "- ЛФК и нейрореабилитация — 22 сеанса\n\n"
            "РЕКОМЕНДАЦИИ:\n"
            "1. Продолжить антиагрегантную терапию\n"
            "2. Контроль АД ежедневно\n"
            "3. Амбулаторное наблюдение через 1 месяц\n"
            "\n[Черновик — требует подписи врача]\n"
        ),
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Согласие на тромболизис",
        "category": "consent",
        "file_name": "consent-thrombolysis.txt",
        "mime_type": "text/plain",
        "description": "Информированное добровольное согласие на тромболитическую терапию",
        "days_offset": -58,
        "uploaded_by": ADMIN_ID,
        "content": (
            "ИНФОРМИРОВАННОЕ ДОБРОВОЛЬНОЕ СОГЛАСИЕ\n"
            "на проведение тромболитической терапии\n\n"
            "Пациент: Уметов Асан Бакирович\n"
            "Дата: " + (now + timedelta(days=-58)).strftime("%d.%m.%Y") + "\n\n"
            "Я, Уметов Асан Бакирович, настоящим подтверждаю, что:\n"
            "- ознакомлен с сутью процедуры тромболизиса;\n"
            "- проинформирован о возможных рисках и осложнениях;\n"
            "- добровольно даю согласие на проведение данного лечения.\n\n"
            "Подпись пациента: _____________\n"
            "Подпись врача: Исаков Б. — ___________\n"
            "Дата и время: " + (now + timedelta(days=-58)).strftime("%d.%m.%Y %H:%M") + "\n"
        ),
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Направление на реабилитацию",
        "category": "referral",
        "file_name": "referral-rehab.txt",
        "mime_type": "text/plain",
        "description": "Направление в реабилитационный центр «Саламат»",
        "days_offset": -10,
        "uploaded_by": DOCTOR_ID,
        "content": (
            "НАПРАВЛЕНИЕ НА РЕАБИЛИТАЦИЮ\n"
            "Дата: " + (now + timedelta(days=-10)).strftime("%d.%m.%Y") + "\n\n"
            "Направляется: Уметов Асан Бакирович, 1985 г.р.\n"
            "В: Реабилитационный центр «Саламат», г. Бишкек\n\n"
            "ДИАГНОЗ: Ишемический инсульт, восстановительный период\n\n"
            "ЦЕЛЬ РЕАБИЛИТАЦИИ:\n"
            "- Восстановление двигательных функций правой руки\n"
            "- Улучшение речевой функции\n"
            "- Снижение степени инвалидности по шкале mRS до 1 балла\n\n"
            "Лечащий врач: Исаков Бакыт\n"
            "Специализация: Невролог\n"
        ),
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Полис ОМС",
        "category": "insurance",
        "file_name": "insurance-oms.txt",
        "mime_type": "text/plain",
        "description": "Копия полиса обязательного медицинского страхования",
        "days_offset": -58,
        "uploaded_by": ADMIN_ID,
        "content": (
            "ПОЛИС ОБЯЗАТЕЛЬНОГО МЕДИЦИНСКОГО СТРАХОВАНИЯ\n"
            "(копия для медицинской карты)\n\n"
            "ФИО: Уметов Асан Бакирович\n"
            "Дата рождения: 15.03.1985\n"
            "Серия/Номер полиса: КР-ОМС 0012345678\n"
            "Страховая организация: ФОМС Кыргызской Республики\n"
            "Срок действия: бессрочный\n\n"
            "Документ является копией. Оригинал хранится у застрахованного.\n"
        ),
    },
]


async def seed_documents(session):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print("Seeding documents …")
    added = 0
    for doc in DOCUMENTS:
        # Write the actual file
        file_path = os.path.join(UPLOAD_DIR, doc["file_name"])
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(doc["content"])
        file_size = os.path.getsize(file_path)
        file_url = f"/uploads/{doc['file_name']}"
        uploaded_at = ts(doc["days_offset"], hour=11)

        await session.execute(text("""
            INSERT INTO documents
                (id, clinic_id, patient_id, title, category, file_url, file_name,
                 file_size, mime_type, description, uploaded_by_id, uploaded_at,
                 is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :patient_id, :title, :category, :file_url, :file_name,
                 :file_size, :mime_type, :description, :uploaded_by_id, :uploaded_at,
                 false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": doc["id"],
            "clinic_id": CLINIC_ID,
            "patient_id": PATIENT_ID,
            "title": doc["title"],
            "category": doc["category"],
            "file_url": file_url,
            "file_name": doc["file_name"],
            "file_size": file_size,
            "mime_type": doc["mime_type"],
            "description": doc["description"],
            "uploaded_by_id": doc["uploaded_by"],
            "uploaded_at": uploaded_at,
            "created_at": uploaded_at,
            "updated_at": uploaded_at,
        })
        added += 1
    print(f"  → {added} documents + files written to {UPLOAD_DIR}")


# --------------------------------------------------------------------------- #
# 2. TELEMEDICINE SESSIONS + MESSAGES
# --------------------------------------------------------------------------- #

SESSION_1_ID = str(uuid.uuid4())  # COMPLETED 30 days ago
SESSION_2_ID = str(uuid.uuid4())  # COMPLETED 15 days ago
SESSION_3_ID = str(uuid.uuid4())  # ACTIVE now
SESSION_4_ID = str(uuid.uuid4())  # WAITING tomorrow


async def seed_telemedicine(session):
    print("Seeding telemedicine sessions …")

    sessions_data = [
        {
            "id": SESSION_1_ID,
            "room_id": f"room-{uuid.uuid4().hex[:8]}",
            "status": "COMPLETED",
            "started_at": ts(-30, hour=10, minute=0),
            "ended_at":   ts(-30, hour=10, minute=45),
            "duration_seconds": 45 * 60,
            "doctor_notes": (
                "Пациент демонстрирует положительную динамику: восстановление "
                "двигательной функции правой руки улучшилось с 20% до ~45%. "
                "Речевая функция улучшилась, дизартрия снизилась. "
                "Рекомендовано усилить нагрузку в ЛФК-упражнениях."
            ),
        },
        {
            "id": SESSION_2_ID,
            "room_id": f"room-{uuid.uuid4().hex[:8]}",
            "status": "COMPLETED",
            "started_at": ts(-15, hour=14, minute=0),
            "ended_at":   ts(-15, hour=14, minute=20),
            "duration_seconds": 20 * 60,
            "doctor_notes": (
                "Контрольный осмотр. АД 135/85 — хорошая динамика. "
                "Приверженность к лечению удовлетворительная. "
                "Скорректирована доза Аторвастатина — повышена до 40 мг."
            ),
        },
        {
            "id": SESSION_3_ID,
            "room_id": f"room-{uuid.uuid4().hex[:8]}",
            "status": "ACTIVE",
            "started_at": now - timedelta(minutes=10),
            "ended_at": None,
            "duration_seconds": None,
            "doctor_notes": None,
        },
        {
            "id": SESSION_4_ID,
            "room_id": f"room-{uuid.uuid4().hex[:8]}",
            "status": "WAITING",
            "started_at": None,
            "ended_at": None,
            "duration_seconds": None,
            "doctor_notes": None,
        },
    ]

    for s in sessions_data:
        created_at = s["started_at"] or ts(1, hour=9)
        await session.execute(text("""
            INSERT INTO telemedicine_sessions
                (id, clinic_id, patient_id, doctor_id, room_id, status,
                 started_at, ended_at, duration_seconds, doctor_notes,
                 is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :patient_id, :doctor_id, :room_id, :status,
                 :started_at, :ended_at, :duration_seconds, :doctor_notes,
                 false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": s["id"],
            "clinic_id": CLINIC_ID,
            "patient_id": PATIENT_ID,
            "doctor_id": DOCTOR_ID,
            "room_id": s["room_id"],
            "status": s["status"],
            "started_at": s["started_at"],
            "ended_at": s["ended_at"],
            "duration_seconds": s["duration_seconds"],
            "doctor_notes": s["doctor_notes"],
            "created_at": created_at,
            "updated_at": created_at,
        })

    print("  → 4 telemedicine sessions")

    # Chat messages for the 2 completed sessions
    print("Seeding messages …")
    messages = [
        # Session 1 (30 days ago)
        {
            "id": str(uuid.uuid4()),
            "sender_id": DOCTOR_ID,
            "recipient_id": ADMIN_ID,  # proxy for patient user; use admin as recipient
            "patient_id": PATIENT_ID,
            "content": "Добрый день, Асан! Как себя чувствуете сегодня? Расскажите о самочувствии.",
            "sent_at": ts(-30, hour=10, minute=2),
            "is_read": True,
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": ADMIN_ID,
            "recipient_id": DOCTOR_ID,
            "patient_id": PATIENT_ID,
            "content": "Здравствуйте, доктор. Сегодня чувствую себя лучше. Рука всё ещё слабая, но я выполнял упражнения каждый день.",
            "sent_at": ts(-30, hour=10, minute=3),
            "is_read": True,
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": DOCTOR_ID,
            "recipient_id": ADMIN_ID,
            "patient_id": PATIENT_ID,
            "content": "Отлично! Продолжайте упражнения. Я скорректировал план — добавлю более интенсивные упражнения на следующей неделе.",
            "sent_at": ts(-30, hour=10, minute=15),
            "is_read": True,
        },
        # Session 2 (15 days ago)
        {
            "id": str(uuid.uuid4()),
            "sender_id": DOCTOR_ID,
            "recipient_id": ADMIN_ID,
            "patient_id": PATIENT_ID,
            "content": "Асан, пришли результаты анализов. Холестерин снизился до 5.1 — хорошая динамика. Продолжаем Аторвастатин 40 мг.",
            "sent_at": ts(-15, hour=14, minute=3),
            "is_read": True,
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": ADMIN_ID,
            "recipient_id": DOCTOR_ID,
            "patient_id": PATIENT_ID,
            "content": "Понял, доктор. А давление — 135/85, это нормально?",
            "sent_at": ts(-15, hour=14, minute=6),
            "is_read": True,
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": DOCTOR_ID,
            "recipient_id": ADMIN_ID,
            "patient_id": PATIENT_ID,
            "content": "Да, 135/85 — это хорошая динамика по сравнению с поступлением (160/95). Продолжайте контролировать ежедневно.",
            "sent_at": ts(-15, hour=14, minute=8),
            "is_read": True,
        },
    ]

    msg_added = 0
    for m in messages:
        await session.execute(text("""
            INSERT INTO messages
                (id, clinic_id, sender_id, recipient_id, patient_id,
                 content, is_read, is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :sender_id, :recipient_id, :patient_id,
                 :content, :is_read, false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": m["id"],
            "clinic_id": CLINIC_ID,
            "sender_id": m["sender_id"],
            "recipient_id": m["recipient_id"],
            "patient_id": m["patient_id"],
            "content": m["content"],
            "is_read": m["is_read"],
            "created_at": m["sent_at"],
            "updated_at": m["sent_at"],
        })
        msg_added += 1

    print(f"  → {msg_added} chat messages")


# --------------------------------------------------------------------------- #
# 3. APPOINTMENTS (+10 for the next 14 days)
# --------------------------------------------------------------------------- #

async def seed_appointments(session):
    print("Seeding appointments …")

    all_patients = [PATIENT_ID] + OTHER_PATIENTS
    all_doctors  = [DOCTOR_ID] + OTHER_DOCTORS

    schedule = [
        # (days_from_now, hour, minute, type, status, patient_idx, doctor_idx, reason)
        (1,  9,  0,  "FOLLOW_UP",    "SCHEDULED",  0, 0, "Контрольный осмотр невролога"),
        (1,  10, 30, "CONSULTATION", "SCHEDULED",  1, 1, "Первичная консультация"),
        (2,  9,  0,  "CONSULTATION", "CONFIRMED",  2, 0, "Консультация по головной боли"),
        (2,  14, 0,  "TELEMEDICINE", "SCHEDULED",  0, 0, "Телемедицинская сессия — реабилитация"),
        (3,  10, 0,  "FOLLOW_UP",    "CONFIRMED",  3, 1, "Контроль АД и холестерина"),
        (3,  15, 30, "PROCEDURE",    "SCHEDULED",  4, 2, "Физиотерапия — нейромышечная стимуляция"),
        (5,  9,  0,  "FOLLOW_UP",    "SCHEDULED",  0, 0, "Плановый осмотр — неделя 9"),
        (6,  11, 0,  "CONSULTATION", "SCHEDULED",  1, 3, "Повторная консультация"),
        (7,  14, 0,  "TELEMEDICINE", "SCHEDULED",  0, 0, "Видеоконсультация — обсуждение выписки"),
        (10, 9,  30, "FOLLOW_UP",    "SCHEDULED",  2, 1, "Послеоперационный осмотр"),
    ]

    added = 0
    for days, hour, minute, appt_type, status, p_idx, d_idx, reason in schedule:
        start_dt = datetime(now.year, now.month, now.day, hour, minute, 0, tzinfo=timezone.utc) + timedelta(days=days)
        end_dt   = start_dt + timedelta(minutes=30)
        pid = all_patients[p_idx % len(all_patients)]
        did = all_doctors[d_idx % len(all_doctors)]

        await session.execute(text("""
            INSERT INTO appointments
                (id, clinic_id, patient_id, doctor_id, appointment_type, status,
                 scheduled_start, scheduled_end, reason, is_walk_in,
                 is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :patient_id, :doctor_id, :appointment_type, :status,
                 :scheduled_start, :scheduled_end, :reason, false,
                 false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": str(uuid.uuid4()),
            "clinic_id": CLINIC_ID,
            "patient_id": pid,
            "doctor_id": did,
            "appointment_type": appt_type,
            "status": status,
            "scheduled_start": start_dt,
            "scheduled_end": end_dt,
            "reason": reason,
            "created_at": now,
            "updated_at": now,
        })
        added += 1

    print(f"  → {added} new appointments")


# --------------------------------------------------------------------------- #
# 4. AUDIT LOGS (15–20 entries over 60 days)
# --------------------------------------------------------------------------- #

async def seed_audit_logs(session):
    print("Seeding audit logs …")

    logs = [
        # (days_offset, user_id, action, resource_type, resource_id, old_values, new_values, ip)
        (-58, ADMIN_ID,  "patient_created",        "Patient",      PATIENT_ID,
            None,
            {"first_name": "Асан", "last_name": "Уметов", "status": "ACTIVE"},
            "192.168.1.10"),
        (-58, ADMIN_ID,  "document_uploaded",      "Document",     str(uuid.uuid4()),
            None,
            {"title": "Согласие на тромболизис", "category": "consent"},
            "192.168.1.10"),
        (-55, DOCTOR_ID, "diagnosis_added",        "Patient",      PATIENT_ID,
            None,
            {"icd_code": "I63.3", "description": "Ишемический инсульт левой СМА"},
            "192.168.1.22"),
        (-55, DOCTOR_ID, "document_uploaded",      "Document",     str(uuid.uuid4()),
            None,
            {"title": "КТ головного мозга", "category": "imaging"},
            "192.168.1.22"),
        (-50, ADMIN_ID,  "patient_updated",        "Patient",      PATIENT_ID,
            {"phone": "+996 555 100000"},
            {"phone": "+996 700 123456"},
            "192.168.1.10"),
        (-45, DOCTOR_ID, "prescription_created",   "Medication",   str(uuid.uuid4()),
            None,
            {"drug_name": "Аспирин 100 мг", "frequency": "1×/день"},
            "192.168.1.22"),
        (-40, DOCTOR_ID, "procedure_ordered",      "Procedure",    str(uuid.uuid4()),
            None,
            {"name": "МРТ головного мозга контрольное", "priority": "ROUTINE"},
            "192.168.1.22"),
        (-35, ADMIN_ID,  "room_transfer",          "Patient",      PATIENT_ID,
            {"room": "Палата 101", "bed": "101-2"},
            {"room": "Палата 201", "bed": "201-1"},
            "192.168.1.10"),
        (-30, DOCTOR_ID, "lab_result_approved",    "LabResult",    str(uuid.uuid4()),
            {"status": "PENDING"},
            {"status": "FINAL", "value": "95.0 г/Л"},
            "192.168.1.22"),
        (-28, OTHER_DOCTORS[0], "patient_updated", "Patient",      OTHER_PATIENTS[0],
            {"status": "ACTIVE"},
            {"status": "DISCHARGED"},
            "192.168.1.30"),
        (-25, DOCTOR_ID, "prescription_created",   "Medication",   str(uuid.uuid4()),
            None,
            {"drug_name": "Аторвастатин 40 мг", "frequency": "1×/день вечером"},
            "192.168.1.22"),
        (-20, ADMIN_ID,  "portal_password_reset",  "User",         ADMIN_ID,
            None,
            {"action": "password_reset_email_sent"},
            "10.0.0.5"),
        (-18, DOCTOR_ID, "document_uploaded",      "Document",     str(uuid.uuid4()),
            None,
            {"title": "МРТ головного мозга — контроль", "category": "imaging"},
            "192.168.1.22"),
        (-15, DOCTOR_ID, "lab_result_approved",    "LabResult",    str(uuid.uuid4()),
            {"status": "PENDING"},
            {"status": "FINAL", "value": "5.1 ммоль/Л"},
            "192.168.1.22"),
        (-12, OTHER_DOCTORS[1], "patient_updated", "Patient",      OTHER_PATIENTS[1],
            {"assigned_doctor_id": OTHER_DOCTORS[0]},
            {"assigned_doctor_id": OTHER_DOCTORS[1]},
            "192.168.1.35"),
        (-10, ADMIN_ID,  "document_uploaded",      "Document",     str(uuid.uuid4()),
            None,
            {"title": "Направление на реабилитацию", "category": "referral"},
            "192.168.1.10"),
        (-7,  DOCTOR_ID, "diagnosis_added",        "Patient",      PATIENT_ID,
            None,
            {"icd_code": "Z96.1", "description": "Состояние после ишемического инсульта"},
            "192.168.1.22"),
        (-5,  DOCTOR_ID, "document_uploaded",      "Document",     str(uuid.uuid4()),
            None,
            {"title": "Выписной эпикриз (черновик)", "category": "discharge"},
            "192.168.1.22"),
        (-3,  ADMIN_ID,  "patient_updated",        "Patient",      PATIENT_ID,
            {"status": "ACTIVE"},
            {"status": "OUTPATIENT"},
            "192.168.1.10"),
        (-1,  DOCTOR_ID, "procedure_ordered",      "Procedure",    str(uuid.uuid4()),
            None,
            {"name": "Контрольный ОАК + СРБ", "priority": "ROUTINE"},
            "192.168.1.22"),
    ]

    import json as _json

    added = 0
    for days, user_id, action, resource_type, resource_id, old_vals, new_vals, ip in logs:
        log_ts = ts(days, hour=11, minute=30)
        # Pass JSON values as serialized strings; use PostgreSQL cast in SQL
        old_json = _json.dumps(old_vals) if old_vals is not None else None
        new_json = _json.dumps(new_vals) if new_vals is not None else None
        await session.execute(text("""
            INSERT INTO audit_logs
                (id, clinic_id, user_id, action, resource_type, resource_id,
                 old_values, new_values, ip_address,
                 is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :user_id, :action, :resource_type, :resource_id,
                 cast(:old_values as jsonb), cast(:new_values as jsonb), :ip_address,
                 false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": str(uuid.uuid4()),
            "clinic_id": CLINIC_ID,
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "old_values": old_json,
            "new_values": new_json,
            "ip_address": ip,
            "created_at": log_ts,
            "updated_at": log_ts,
        })
        added += 1

    print(f"  → {added} audit log entries")


# --------------------------------------------------------------------------- #
# 5. RECOVERY GOALS
# --------------------------------------------------------------------------- #

async def seed_recovery_goals(session):
    print("Seeding recovery goals …")

    goals = [
        # (domain, metric_key, target_value)
        ("VITALS", "systolic_bp",    130.0),
        ("VITALS", "pulse",           72.0),
        ("VITALS", "blood_glucose",    5.5),
        ("LABS",   "hemoglobin",     140.0),
        ("LABS",   "cholesterol",      5.0),
    ]

    added = 0
    for domain, metric_key, target_value in goals:
        await session.execute(text("""
            INSERT INTO recovery_goals
                (id, clinic_id, patient_id, domain, metric_key, target_value, set_by_id,
                 is_deleted, created_at, updated_at)
            VALUES
                (:id, :clinic_id, :patient_id, :domain, :metric_key, :target_value, :set_by_id,
                 false, :created_at, :updated_at)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": str(uuid.uuid4()),
            "clinic_id": CLINIC_ID,
            "patient_id": PATIENT_ID,
            "domain": domain,
            "metric_key": metric_key,
            "target_value": target_value,
            "set_by_id": DOCTOR_ID,
            "created_at": now,
            "updated_at": now,
        })
        added += 1

    print(f"  → {added} recovery goals")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

async def main():
    from app.core.database import async_session_factory

    async with async_session_factory() as session:
        await seed_documents(session)
        await seed_telemedicine(session)
        await seed_appointments(session)
        await seed_audit_logs(session)
        await seed_recovery_goals(session)
        await session.commit()
        print("\nAll mock data committed successfully!")

        # Verification counts
        print("\n--- Verification ---")
        tables = [
            "documents",
            "telemedicine_sessions",
            "messages",
            "appointments",
            "audit_logs",
            "recovery_goals",
        ]
        for tbl in tables:
            r = await session.execute(text(f"SELECT COUNT(*) FROM {tbl}"))
            print(f"  {tbl:<25}: {r.scalar()}")


if __name__ == "__main__":
    asyncio.run(main())
