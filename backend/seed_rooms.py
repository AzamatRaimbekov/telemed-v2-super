"""Seed departments, rooms, beds, and room assignments for patient Уметов Асан."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
from app.core.config import settings

CID = "ab676372-69fa-4af8-be33-91c1e307b4fc"
PID = "22d1278e-cd6a-4bf4-8741-873f9fdca5af"
DID = "b59f37e1-36a9-45b6-919b-20baee0a3ef4"
now = datetime.now(timezone.utc)

# Fixed IDs for idempotency
DEPT_IDS = {
    "Приёмное отделение": "d1000001-0000-4000-a000-000000000001",
    "Реанимация": "d1000001-0000-4000-a000-000000000002",
    "Неврология": "d1000001-0000-4000-a000-000000000003",
    "Терапия": "d1000001-0000-4000-a000-000000000004",
}

ROOM_IDS = {
    "Смотровая 1": "a1000001-0000-4000-a000-000000000001",
    "Реанимация 1": "a1000001-0000-4000-a000-000000000002",
    "Палата 201": "a1000001-0000-4000-a000-000000000003",
    "Палата 202": "a1000001-0000-4000-a000-000000000004",
    "Палата 301": "a1000001-0000-4000-a000-000000000005",
}


async def main():
    conn = await asyncpg.connect(
        host=settings.POSTGRES_HOST, port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER, password=settings.POSTGRES_PASSWORD,
        database=settings.POSTGRES_DB,
    )

    # Check if room assignments already exist for this patient
    cnt = await conn.fetchval(
        "SELECT count(*) FROM room_assignments WHERE patient_id=$1 AND clinic_id=$2",
        uuid.UUID(PID), uuid.UUID(CID),
    )
    if cnt and cnt > 0:
        print(f"Room assignments already seeded ({cnt}). Skipping.")
        await conn.close()
        return

    cid = uuid.UUID(CID)

    # Departments (ON CONFLICT — may already exist from seed_prod_all)
    for name, did_str in DEPT_IDS.items():
        did = uuid.UUID(did_str)
        await conn.execute(
            """INSERT INTO departments (id,clinic_id,name,is_active,is_deleted,created_at,updated_at)
               VALUES ($1,$2,$3,true,false,now(),now())
               ON CONFLICT (id) DO NOTHING""",
            did, cid, name,
        )
    print("Departments OK (4)")

    # Rooms
    rooms_data = [
        (DEPT_IDS["Приёмное отделение"], "Смотровая 1", "ER-01", "CONSULTATION", 2, 1),
        (DEPT_IDS["Реанимация"], "Реанимация 1", "ICU-01", "ICU", 4, 2),
        (DEPT_IDS["Неврология"], "Палата 201", "N-201", "WARD", 4, 2),
        (DEPT_IDS["Неврология"], "Палата 202", "N-202", "WARD", 2, 2),
        (DEPT_IDS["Терапия"], "Палата 301", "T-301", "WARD", 4, 3),
    ]
    for dept_id_str, name, num, rtype, cap, floor in rooms_data:
        rid = uuid.UUID(ROOM_IDS[name])
        await conn.execute(
            """INSERT INTO rooms (id,clinic_id,department_id,name,room_number,room_type,capacity,floor,is_active,is_deleted,created_at,updated_at)
               VALUES ($1,$2,$3,$4,$5,$6::roomtype,$7,$8,true,false,now(),now())
               ON CONFLICT (id) DO NOTHING""",
            rid, cid, uuid.UUID(dept_id_str), name, num, rtype, cap, floor,
        )
    print("Rooms OK (5)")

    # Beds
    bed_ids = {}
    bed_counter = 0
    for room_name, count in [("Смотровая 1", 2), ("Реанимация 1", 4), ("Палата 201", 4), ("Палата 202", 2), ("Палата 301", 4)]:
        ids = []
        for i in range(1, count + 1):
            bid = uuid.uuid5(uuid.NAMESPACE_DNS, f"bed-{room_name}-{i}")
            await conn.execute(
                """INSERT INTO beds (id,clinic_id,room_id,bed_number,status,is_deleted,created_at,updated_at)
                   VALUES ($1,$2,$3,$4,$5::bedstatus,false,now(),now())
                   ON CONFLICT (id) DO NOTHING""",
                bid, cid, uuid.UUID(ROOM_IDS[room_name]), str(i), "AVAILABLE",
            )
            ids.append(bid)
            bed_counter += 1
        bed_ids[room_name] = ids
    print(f"Beds OK ({bed_counter})")

    # Mark some beds occupied
    await conn.execute("UPDATE beds SET status='OCCUPIED'::bedstatus WHERE id=$1", bed_ids["Палата 201"][1])
    await conn.execute("UPDATE beds SET status='OCCUPIED'::bedstatus WHERE id=$1", bed_ids["Реанимация 1"][0])
    await conn.execute("UPDATE beds SET status='OCCUPIED'::bedstatus WHERE id=$1", bed_ids["Палата 201"][3])

    # Room assignments
    hosp = uuid.uuid5(uuid.NAMESPACE_DNS, f"hospitalization-{PID}")
    t1 = now - timedelta(days=10)
    t2 = t1 + timedelta(hours=4)
    t3 = now - timedelta(days=7)

    sql = """INSERT INTO room_assignments
        (id,clinic_id,patient_id,department_id,room_id,bed_id,
         placement_type,assigned_at,released_at,duration_minutes,
         transfer_reason,condition_on_transfer,transferred_by,
         hospitalization_id,notes,is_deleted,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7::placementtype,$8,$9,$10,$11,$12::transfercondition,$13,$14,$15,false,now(),now())"""

    assignments = [
        (DEPT_IDS["Приёмное отделение"], ROOM_IDS["Смотровая 1"], bed_ids["Смотровая 1"][0],
         "emergency_room", "critical", t1, t2, 240,
         "Поступление по скорой — подозрение на инсульт", "КТ головного мозга выполнено"),
        (DEPT_IDS["Реанимация"], ROOM_IDS["Реанимация 1"], bed_ids["Реанимация 1"][1],
         "icu", "improved", t2, t3, 4320,
         "Стабилизация после тромболизиса", "Тромболизис проведён успешно"),
        (DEPT_IDS["Неврология"], ROOM_IDS["Палата 201"], bed_ids["Палата 201"][1],
         "ward", "stable", t3, None, None,
         "Перевод для реабилитации", "Начата программа реабилитации"),
    ]

    for dep_id_str, rid_str, bid, pt, ct, aa, ra, dm, tr, notes in assignments:
        await conn.execute(sql,
            uuid.uuid4(), cid, uuid.UUID(PID), uuid.UUID(dep_id_str),
            uuid.UUID(rid_str), bid,
            pt, aa, ra, dm, tr, ct, uuid.UUID(DID), hosp, notes,
        )
    print("Created 3 room assignments (ER → ICU → Ward)")
    print("Current: Неврология > Палата 201 > Койка 2")

    await conn.close()
    print("Done!")


asyncio.run(main())
