"""
Seed pharmacy module: suppliers, inventory batches, prescriptions,
purchase orders, dispense records, inventory logs.

Patient : Уметов Асан Бакирович (22d1278e-cd6a-4bf4-8741-873f9fdca5af)
Doctor  : Бакыт Исаков           (b59f37e1-36a9-45b6-919b-20baee0a3ef4)
Admin   : 88d553e7-ba10-4f13-91cd-8a7456105625
Clinic  : ab676372-69fa-4af8-be33-91c1e307b4fc

Run:
  cd backend && .venv/bin/python seed_pharmacy.py
"""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text
from app.core.database import async_session_factory
from app.models.medication import (
    Drug,
    Supplier,
    Inventory,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    Prescription,
    PrescriptionItem,
    PrescriptionStatus,
    RouteOfAdministration,
    InventoryLog,
    InventoryOperationType,
    DispenseRecord,
)

# ── Known IDs ──────────────────────────────────────────────────────────────── #
CLINIC_ID  = "ab676372-69fa-4af8-be33-91c1e307b4fc"
ADMIN_ID   = "88d553e7-ba10-4f13-91cd-8a7456105625"
DOCTOR_ID  = "b59f37e1-36a9-45b6-919b-20baee0a3ef4"
PATIENT_ID = "22d1278e-cd6a-4bf4-8741-873f9fdca5af"

CID = uuid.UUID(CLINIC_ID)
now = datetime.now(timezone.utc)
today = date.today()


def ts(days_offset: int, hour: int = 10, minute: int = 0) -> datetime:
    """Return a timezone-aware datetime offset from today."""
    return datetime(now.year, now.month, now.day, hour, minute, 0,
                    tzinfo=timezone.utc) + timedelta(days=days_offset)


# ── Supplier definitions ──────────────────────────────────────────────────── #
SUPPLIER_DEFS = [
    {
        "name": "ФармМед КГ",
        "contact_person": "Алиев Марат Асылбекович",
        "phone": "+996 555 100 100",
        "email": "info@farmmed.kg",
        "address": "г. Бишкек, ул. Московская 172, оф. 4",
    },
    {
        "name": "МедИмпорт",
        "contact_person": "Касымова Айнура Бакытовна",
        "phone": "+996 555 200 200",
        "email": "sales@medimport.kg",
        "address": "г. Бишкек, ул. Абдрахманова 150",
    },
    {
        "name": "БиоФарм Центр",
        "contact_person": "Токтоев Эрлан Жумабекович",
        "phone": "+996 555 300 300",
        "email": "order@biofarm.kg",
        "address": "г. Бишкек, ул. Боконбаева 58",
    },
    {
        "name": "Здоровье Плюс",
        "contact_person": "Сатыбалдиева Гульнара",
        "phone": "+996 555 400 400",
        "email": "info@zdorovie-plus.kg",
        "address": "г. Бишкек, ул. Киевская 218",
    },
    {
        "name": "ФармЛогистик",
        "contact_person": "Орунбаев Данияр Кубатович",
        "phone": "+996 555 500 500",
        "email": "logistics@farmlog.kg",
        "address": "г. Бишкек, ул. Жибек Жолу 392",
    },
]


async def main() -> None:
    async with async_session_factory() as s:
        # ── 0. Clear existing pharmacy data ──────────────────────────────── #
        print("Clearing existing pharmacy data...")
        for tbl in [
            "inventory_logs",
            "dispense_records",
            "purchase_order_items",
            "purchase_orders",
            "prescription_items",
            "prescriptions",
            "inventory",
            "suppliers",
        ]:
            await s.execute(
                text(f"DELETE FROM {tbl} WHERE clinic_id = :cid"),
                {"cid": CLINIC_ID},
            )
        await s.flush()
        print("  Cleared.")

        # ── 1. Load drugs from catalog ───────────────────────────────────── #
        drugs_all = list(
            (await s.execute(
                select(Drug).where(Drug.clinic_id == CID, Drug.is_active == True)
            )).scalars().all()
        )
        if not drugs_all:
            print("ERROR: No drugs found. Run seed_catalogs.py first!")
            return

        # Build a dict by name for easy lookup
        drug_by_name: dict[str, Drug] = {d.name: d for d in drugs_all}
        print(f"  Found {len(drugs_all)} drugs in catalog")

        # ── 2. Suppliers ─────────────────────────────────────────────────── #
        suppliers: list[Supplier] = []
        for sd in SUPPLIER_DEFS:
            sup = Supplier(
                id=uuid.uuid4(),
                clinic_id=CID,
                **sd,
            )
            s.add(sup)
            suppliers.append(sup)
        await s.flush()
        print(f"  Seeded {len(suppliers)} suppliers")

        # Short aliases
        sup_farmmed    = suppliers[0]  # ФармМед КГ
        sup_medimport  = suppliers[1]  # МедИмпорт
        sup_biofarm    = suppliers[2]  # БиоФарм Центр
        sup_zdorovie   = suppliers[3]  # Здоровье Плюс
        sup_farmlog    = suppliers[4]  # ФармЛогистик

        # ── 3. Inventory batches ─────────────────────────────────────────── #
        # We create 2-3 batches per drug with varying conditions.
        #
        # Drug index mapping (from seed_catalogs.py order):
        #  0  Аспирин          1  Амоксициллин     2  Метформин
        #  3  Лозартан         4  Омепразол        5  Эналаприл
        #  6  Бисопролол       7  Варфарин         8  Цефтриаксон
        #  9  Диклофенак      10  Парацетамол     11  Ибупрофен
        # 12  Амлодипин       13  Дексаметазон    14  Инсулин Хумалог

        inventory_map: dict[str, list[Inventory]] = {}  # drug_name -> [Inventory]
        all_batches: list[Inventory] = []

        def add_batch(
            drug_name: str,
            batch_suffix: str,
            qty: int,
            expiry: date,
            price: float,
            supplier: Supplier,
            location: str = "Склад A",
            threshold: int = 10,
        ) -> Inventory:
            drug = drug_by_name[drug_name]
            code = drug_name[:3].upper()
            inv = Inventory(
                id=uuid.uuid4(),
                clinic_id=CID,
                drug_id=drug.id,
                quantity=qty,
                batch_number=f"LOT-2026-{code}-{batch_suffix}",
                expiry_date=expiry,
                purchase_price=price,
                supplier_id=supplier.id,
                low_stock_threshold=threshold,
                location=location,
            )
            s.add(inv)
            all_batches.append(inv)
            inventory_map.setdefault(drug_name, []).append(inv)
            return inv

        # --- Аспирин: normal stock ---
        add_batch("Аспирин", "001", 200, today + timedelta(days=365), 30.0, sup_farmmed)
        add_batch("Аспирин", "002", 80, today + timedelta(days=180), 32.0, sup_farmlog)

        # --- Амоксициллин: EXPIRING SOON (within 30 days) ---
        add_batch("Амоксициллин", "001", 150, today + timedelta(days=540), 75.0, sup_medimport)
        add_batch("Амоксициллин", "002", 45, today + timedelta(days=18), 78.0, sup_farmmed)  # EXPIRING SOON
        add_batch("Амоксициллин", "003", 20, today + timedelta(days=7), 70.0, sup_biofarm)    # EXPIRING SOON

        # --- Метформин: normal ---
        add_batch("Метформин", "001", 300, today + timedelta(days=400), 50.0, sup_farmmed)
        add_batch("Метформин", "002", 120, today + timedelta(days=270), 52.0, sup_farmlog)

        # --- Лозартан: EXPIRED batch + normal batch ---
        add_batch("Лозартан", "001", 100, today + timedelta(days=300), 95.0, sup_medimport)
        add_batch("Лозартан", "002", 35, today - timedelta(days=15), 90.0, sup_farmmed)  # EXPIRED

        # --- Омепразол: LOW STOCK ---
        add_batch("Омепразол", "001", 5, today + timedelta(days=200), 55.0, sup_zdorovie, threshold=20)  # BELOW threshold
        add_batch("Омепразол", "002", 3, today + timedelta(days=150), 58.0, sup_farmlog, threshold=20)   # BELOW threshold

        # --- Эналаприл: normal ---
        add_batch("Эналаприл", "001", 250, today + timedelta(days=450), 42.0, sup_farmmed)
        add_batch("Эналаприл", "002", 60, today + timedelta(days=220), 45.0, sup_biofarm)

        # --- Бисопролол: EXPIRING SOON ---
        add_batch("Бисопролол", "001", 180, today + timedelta(days=500), 62.0, sup_medimport)
        add_batch("Бисопролол", "002", 30, today + timedelta(days=25), 60.0, sup_farmmed)  # EXPIRING SOON

        # --- Варфарин: normal ---
        add_batch("Варфарин", "001", 90, today + timedelta(days=350), 130.0, sup_medimport)
        add_batch("Варфарин", "002", 40, today + timedelta(days=180), 125.0, sup_biofarm)

        # --- Цефтриаксон: EXPIRED + normal ---
        add_batch("Цефтриаксон", "001", 200, today + timedelta(days=600), 160.0, sup_biofarm, location="Холодильник 1")
        add_batch("Цефтриаксон", "002", 15, today - timedelta(days=5), 155.0, sup_farmmed, location="Холодильник 1")  # EXPIRED

        # --- Диклофенак: ZERO STOCK ---
        add_batch("Диклофенак", "001", 0, today + timedelta(days=365), 35.0, sup_zdorovie)

        # --- Парацетамол: ZERO STOCK ---
        add_batch("Парацетамол", "001", 0, today + timedelta(days=300), 18.0, sup_farmmed)

        # --- Ибупрофен: normal ---
        add_batch("Ибупрофен", "001", 350, today + timedelta(days=420), 28.0, sup_farmlog)
        add_batch("Ибупрофен", "002", 100, today + timedelta(days=240), 30.0, sup_zdorovie)

        # --- Амлодипин: EXPIRING SOON ---
        add_batch("Амлодипин", "001", 140, today + timedelta(days=380), 70.0, sup_medimport)
        add_batch("Амлодипин", "002", 55, today + timedelta(days=12), 68.0, sup_farmmed)  # EXPIRING SOON

        # --- Дексаметазон: normal ---
        add_batch("Дексаметазон", "001", 80, today + timedelta(days=500), 115.0, sup_biofarm, location="Холодильник 2")
        add_batch("Дексаметазон", "002", 25, today + timedelta(days=180), 120.0, sup_zdorovie, location="Холодильник 2")

        # --- Инсулин Хумалог: LOW STOCK ---
        add_batch("Инсулин Хумалог", "001", 8, today + timedelta(days=270), 520.0, sup_biofarm, location="Холодильник 1", threshold=15)
        add_batch("Инсулин Хумалог", "002", 4, today + timedelta(days=150), 530.0, sup_medimport, location="Холодильник 1", threshold=15)

        await s.flush()
        print(f"  Seeded {len(all_batches)} inventory batches")

        # ── 4. Purchase Orders ───────────────────────────────────────────── #
        po_list: list[PurchaseOrder] = []

        # PO-1: RECEIVED from ФармМед КГ (10 days ago)
        po1 = PurchaseOrder(
            id=uuid.uuid4(), clinic_id=CID,
            supplier_id=sup_farmmed.id,
            ordered_by_id=uuid.UUID(ADMIN_ID),
            status=PurchaseOrderStatus.RECEIVED,
            total_amount=24500.0,
            notes="Плановое пополнение склада — таблетированные формы",
            ordered_at=ts(-12, 9, 30),
            received_at=ts(-10, 14, 0),
        )
        s.add(po1)
        po_list.append(po1)
        await s.flush()

        for dname, qty_ord, qty_rcv, price in [
            ("Аспирин", 200, 200, 30.0),
            ("Метформин", 150, 150, 50.0),
            ("Эналаприл", 100, 100, 42.0),
            ("Бисопролол", 80, 80, 62.0),
        ]:
            s.add(PurchaseOrderItem(
                id=uuid.uuid4(), clinic_id=CID,
                purchase_order_id=po1.id,
                drug_id=drug_by_name[dname].id,
                quantity_ordered=qty_ord,
                quantity_received=qty_rcv,
                unit_price=price,
            ))

        # PO-2: RECEIVED from БиоФарм Центр (20 days ago) — injections
        po2 = PurchaseOrder(
            id=uuid.uuid4(), clinic_id=CID,
            supplier_id=sup_biofarm.id,
            ordered_by_id=uuid.UUID(ADMIN_ID),
            status=PurchaseOrderStatus.RECEIVED,
            total_amount=38800.0,
            notes="Закупка инъекционных препаратов",
            ordered_at=ts(-22, 10, 0),
            received_at=ts(-20, 11, 30),
        )
        s.add(po2)
        po_list.append(po2)
        await s.flush()

        for dname, qty_ord, qty_rcv, price in [
            ("Цефтриаксон", 100, 100, 160.0),
            ("Дексаметазон", 50, 50, 115.0),
            ("Инсулин Хумалог", 20, 20, 520.0),
        ]:
            s.add(PurchaseOrderItem(
                id=uuid.uuid4(), clinic_id=CID,
                purchase_order_id=po2.id,
                drug_id=drug_by_name[dname].id,
                quantity_ordered=qty_ord,
                quantity_received=qty_rcv,
                unit_price=price,
            ))

        # PO-3: SUBMITTED to МедИмпорт (3 days ago) — waiting delivery
        po3 = PurchaseOrder(
            id=uuid.uuid4(), clinic_id=CID,
            supplier_id=sup_medimport.id,
            ordered_by_id=uuid.UUID(ADMIN_ID),
            status=PurchaseOrderStatus.SUBMITTED,
            total_amount=18500.0,
            notes="Срочный заказ: Амоксициллин заканчивается, Варфарин на пополнение",
            ordered_at=ts(-3, 11, 0),
            received_at=None,
        )
        s.add(po3)
        po_list.append(po3)
        await s.flush()

        for dname, qty_ord, price in [
            ("Амоксициллин", 200, 75.0),
            ("Варфарин", 50, 130.0),
            ("Амлодипин", 100, 70.0),
        ]:
            s.add(PurchaseOrderItem(
                id=uuid.uuid4(), clinic_id=CID,
                purchase_order_id=po3.id,
                drug_id=drug_by_name[dname].id,
                quantity_ordered=qty_ord,
                quantity_received=0,
                unit_price=price,
            ))

        # PO-4: DRAFT — not yet sent
        po4 = PurchaseOrder(
            id=uuid.uuid4(), clinic_id=CID,
            supplier_id=sup_zdorovie.id,
            ordered_by_id=uuid.UUID(ADMIN_ID),
            status=PurchaseOrderStatus.DRAFT,
            total_amount=5600.0,
            notes="Черновик: пополнение мазей и сиропов",
            ordered_at=ts(-1, 16, 0),
            received_at=None,
        )
        s.add(po4)
        po_list.append(po4)
        await s.flush()

        for dname, qty_ord, price in [
            ("Диклофенак", 100, 35.0),
            ("Парацетамол", 200, 18.0),
            ("Омепразол", 50, 55.0),
        ]:
            s.add(PurchaseOrderItem(
                id=uuid.uuid4(), clinic_id=CID,
                purchase_order_id=po4.id,
                drug_id=drug_by_name[dname].id,
                quantity_ordered=qty_ord,
                quantity_received=0,
                unit_price=price,
            ))

        # PO-5: CANCELLED — from ФармЛогистик
        po5 = PurchaseOrder(
            id=uuid.uuid4(), clinic_id=CID,
            supplier_id=sup_farmlog.id,
            ordered_by_id=uuid.UUID(ADMIN_ID),
            status=PurchaseOrderStatus.CANCELLED,
            total_amount=12000.0,
            notes="Отменён: поставщик не смог обеспечить сроки доставки",
            ordered_at=ts(-15, 9, 0),
            received_at=None,
        )
        s.add(po5)
        po_list.append(po5)
        await s.flush()

        for dname, qty_ord, price in [
            ("Лозартан", 80, 95.0),
            ("Ибупрофен", 150, 28.0),
        ]:
            s.add(PurchaseOrderItem(
                id=uuid.uuid4(), clinic_id=CID,
                purchase_order_id=po5.id,
                drug_id=drug_by_name[dname].id,
                quantity_ordered=qty_ord,
                quantity_received=0,
                unit_price=price,
            ))

        await s.flush()
        print(f"  Seeded {len(po_list)} purchase orders with items")

        # ── 5. Prescriptions ─────────────────────────────────────────────── #
        patient_id = uuid.UUID(PATIENT_ID)
        doctor_id = uuid.UUID(DOCTOR_ID)

        rx_list: list[Prescription] = []
        rx_items_all: list[PrescriptionItem] = []

        def add_rx(
            status: PrescriptionStatus,
            notes: str,
            prescribed_at: datetime,
            items: list[dict],
        ) -> tuple[Prescription, list[PrescriptionItem]]:
            rx = Prescription(
                id=uuid.uuid4(), clinic_id=CID,
                patient_id=patient_id,
                doctor_id=doctor_id,
                status=status,
                notes=notes,
                prescribed_at=prescribed_at,
            )
            s.add(rx)
            rx_list.append(rx)
            created_items = []
            for it in items:
                pi = PrescriptionItem(
                    id=uuid.uuid4(), clinic_id=CID,
                    prescription_id=rx.id,
                    drug_id=drug_by_name[it["drug"]].id,
                    dosage=it["dosage"],
                    frequency=it["frequency"],
                    route=it.get("route", RouteOfAdministration.ORAL),
                    duration_days=it.get("duration_days"),
                    quantity=it.get("quantity"),
                    is_prn=it.get("is_prn", False),
                    notes=it.get("notes"),
                )
                s.add(pi)
                created_items.append(pi)
                rx_items_all.append(pi)
            return rx, created_items

        # RX-1: ACTIVE — антибиотикотерапия (today)
        rx1, rx1_items = add_rx(
            PrescriptionStatus.ACTIVE,
            "Антибиотикотерапия при пневмонии. Контроль ОАК через 5 дней.",
            ts(0, 9, 15),
            [
                {"drug": "Амоксициллин", "dosage": "500 мг", "frequency": "3 раза в день",
                 "duration_days": 7, "quantity": 21, "notes": "Принимать после еды"},
                {"drug": "Омепразол", "dosage": "20 мг", "frequency": "1 раз в день утром",
                 "duration_days": 7, "quantity": 7, "notes": "Защита ЖКТ на время антибиотика"},
            ],
        )

        # RX-2: ACTIVE — кардиология (yesterday)
        rx2, rx2_items = add_rx(
            PrescriptionStatus.ACTIVE,
            "Коррекция гипертензии. Контроль АД ежедневно.",
            ts(-1, 10, 30),
            [
                {"drug": "Бисопролол", "dosage": "5 мг", "frequency": "1 раз в день утром",
                 "duration_days": 30, "quantity": 30},
                {"drug": "Лозартан", "dosage": "50 мг", "frequency": "1 раз в день",
                 "duration_days": 30, "quantity": 30},
                {"drug": "Аспирин", "dosage": "75 мг", "frequency": "1 раз в день",
                 "duration_days": 30, "quantity": 30, "notes": "Антиагрегантная терапия"},
            ],
        )

        # RX-3: ACTIVE — обезболивание (2 days ago)
        rx3, rx3_items = add_rx(
            PrescriptionStatus.ACTIVE,
            "Болевой синдром после травмы. При усилении боли — Дексаметазон в/м.",
            ts(-2, 14, 0),
            [
                {"drug": "Ибупрофен", "dosage": "400 мг", "frequency": "до 3 раз в день",
                 "duration_days": 5, "quantity": 15, "is_prn": True,
                 "notes": "Принимать при болях, не более 1200 мг/сут"},
                {"drug": "Дексаметазон", "dosage": "4 мг", "frequency": "1 раз в день",
                 "route": RouteOfAdministration.IM, "duration_days": 3, "quantity": 3,
                 "notes": "В/м при сильной боли"},
            ],
        )

        # RX-4: ACTIVE — эндокринология (3 days ago)
        rx4, rx4_items = add_rx(
            PrescriptionStatus.ACTIVE,
            "Сахарный диабет 2 типа. Контроль глюкозы натощак.",
            ts(-3, 11, 0),
            [
                {"drug": "Метформин", "dosage": "850 мг", "frequency": "2 раза в день",
                 "duration_days": 30, "quantity": 60, "notes": "Во время еды"},
                {"drug": "Инсулин Хумалог", "dosage": "10 ЕД", "frequency": "3 раза в день перед едой",
                 "route": RouteOfAdministration.OTHER, "duration_days": 30, "quantity": 3,
                 "notes": "Подкожно, коррекция дозы по гликемии"},
            ],
        )

        # RX-5: ACTIVE — антикоагулянтная терапия (5 days ago)
        rx5, rx5_items = add_rx(
            PrescriptionStatus.ACTIVE,
            "Профилактика тромбоэмболии. Контроль МНО каждые 3 дня.",
            ts(-5, 9, 45),
            [
                {"drug": "Варфарин", "dosage": "5 мг", "frequency": "1 раз в день вечером",
                 "duration_days": 30, "quantity": 30, "notes": "Целевое МНО 2.0-3.0"},
            ],
        )

        # RX-6: DISPENSED — выдан полностью (7 days ago)
        rx6, rx6_items = add_rx(
            PrescriptionStatus.DISPENSED,
            "Курс НПВС после операции. Завершён.",
            ts(-7, 10, 0),
            [
                {"drug": "Диклофенак", "dosage": "75 мг", "frequency": "2 раза в день",
                 "duration_days": 5, "quantity": 10, "notes": "В/м первые 3 дня, затем таблетки"},
                {"drug": "Омепразол", "dosage": "20 мг", "frequency": "1 раз в день",
                 "duration_days": 5, "quantity": 5, "notes": "Гастропротекция"},
            ],
        )

        # RX-7: DISPENSED — выдан (14 days ago)
        rx7, rx7_items = add_rx(
            PrescriptionStatus.DISPENSED,
            "Инфекционный курс. Цефтриаксон в/в + жаропонижающее.",
            ts(-14, 8, 30),
            [
                {"drug": "Цефтриаксон", "dosage": "1 г", "frequency": "2 раза в день",
                 "route": RouteOfAdministration.IV, "duration_days": 7, "quantity": 14,
                 "notes": "В/в капельно на 100 мл NaCl 0.9%"},
                {"drug": "Парацетамол", "dosage": "500 мг", "frequency": "до 4 раз в день",
                 "duration_days": 7, "quantity": 28, "is_prn": True,
                 "notes": "При температуре выше 38.5"},
            ],
        )

        # RX-8: PARTIALLY_DISPENSED — частично выдан (5 days ago)
        rx8, rx8_items = add_rx(
            PrescriptionStatus.PARTIALLY_DISPENSED,
            "Комплексная терапия. Амлодипин выдан, Эналаприл ожидает.",
            ts(-5, 15, 0),
            [
                {"drug": "Амлодипин", "dosage": "5 мг", "frequency": "1 раз в день",
                 "duration_days": 30, "quantity": 30},
                {"drug": "Эналаприл", "dosage": "10 мг", "frequency": "2 раза в день",
                 "duration_days": 30, "quantity": 60},
                {"drug": "Аспирин", "dosage": "100 мг", "frequency": "1 раз в день",
                 "duration_days": 30, "quantity": 30},
            ],
        )

        # RX-9: CANCELLED — отменён (10 days ago)
        rx9, rx9_items = add_rx(
            PrescriptionStatus.CANCELLED,
            "Отменён из-за аллергической реакции на Амоксициллин. Заменён на Цефтриаксон.",
            ts(-10, 12, 0),
            [
                {"drug": "Амоксициллин", "dosage": "1000 мг", "frequency": "2 раза в день",
                 "duration_days": 10, "quantity": 20},
                {"drug": "Ибупрофен", "dosage": "200 мг", "frequency": "3 раза в день",
                 "duration_days": 5, "quantity": 15},
            ],
        )

        await s.flush()
        print(f"  Seeded {len(rx_list)} prescriptions with {len(rx_items_all)} items")

        # ── 6. Dispense Records ──────────────────────────────────────────── #
        dispense_records: list[DispenseRecord] = []
        admin_uuid = uuid.UUID(ADMIN_ID)

        def add_dispense(
            rx_item: PrescriptionItem,
            inv: Inventory,
            qty: int,
            dispensed_at: datetime,
        ) -> DispenseRecord:
            dr = DispenseRecord(
                id=uuid.uuid4(), clinic_id=CID,
                prescription_item_id=rx_item.id,
                inventory_id=inv.id,
                quantity=qty,
                dispensed_by=admin_uuid,
                dispensed_at=dispensed_at,
            )
            s.add(dr)
            dispense_records.append(dr)
            return dr

        # RX-6 (DISPENSED): Диклофенак + Омепразол
        if "Диклофенак" in inventory_map and "Омепразол" in inventory_map:
            add_dispense(rx6_items[0], inventory_map["Диклофенак"][0], 10, ts(-7, 10, 30))
            add_dispense(rx6_items[1], inventory_map["Омепразол"][0], 5, ts(-7, 10, 30))

        # RX-7 (DISPENSED): Цефтриаксон + Парацетамол
        if "Цефтриаксон" in inventory_map and "Парацетамол" in inventory_map:
            add_dispense(rx7_items[0], inventory_map["Цефтриаксон"][0], 14, ts(-14, 9, 0))
            add_dispense(rx7_items[1], inventory_map["Парацетамол"][0], 28, ts(-14, 9, 0))

        # RX-8 (PARTIALLY_DISPENSED): only Амлодипин dispensed
        if "Амлодипин" in inventory_map:
            add_dispense(rx8_items[0], inventory_map["Амлодипин"][0], 30, ts(-5, 15, 30))

        await s.flush()
        print(f"  Seeded {len(dispense_records)} dispense records")

        # ── 7. Inventory Logs ────────────────────────────────────────────── #
        log_count = 0

        def add_log(
            inv: Inventory,
            op: InventoryOperationType,
            qty_change: int,
            reason: str,
            ref_type: str | None,
            ref_id: uuid.UUID | None,
            created_offset_days: int,
            hour: int = 10,
        ) -> InventoryLog:
            nonlocal log_count
            log = InventoryLog(
                id=uuid.uuid4(), clinic_id=CID,
                inventory_id=inv.id,
                operation_type=op,
                quantity_change=qty_change,
                reason=reason,
                reference_type=ref_type,
                reference_id=ref_id,
                performed_by=admin_uuid,
            )
            s.add(log)
            log_count += 1
            return log

        # RECEIPT logs — for received purchase orders (PO-1 and PO-2)
        for inv_name in ["Аспирин", "Метформин", "Эналаприл", "Бисопролол"]:
            if inv_name in inventory_map:
                add_log(
                    inventory_map[inv_name][0], InventoryOperationType.RECEIPT,
                    200 if inv_name == "Аспирин" else 150 if inv_name == "Метформин" else 100 if inv_name == "Эналаприл" else 80,
                    f"Приёмка по заказу ФармМед КГ",
                    "purchase_order", po1.id, -10,
                )

        for inv_name in ["Цефтриаксон", "Дексаметазон", "Инсулин Хумалог"]:
            if inv_name in inventory_map:
                add_log(
                    inventory_map[inv_name][0], InventoryOperationType.RECEIPT,
                    100 if inv_name == "Цефтриаксон" else 50 if inv_name == "Дексаметазон" else 20,
                    f"Приёмка по заказу БиоФарм Центр",
                    "purchase_order", po2.id, -20,
                )

        # DISPENSE logs — for dispensed prescriptions
        if "Диклофенак" in inventory_map:
            add_log(
                inventory_map["Диклофенак"][0], InventoryOperationType.DISPENSE,
                -10, "Выдача по рецепту: НПВС курс",
                "prescription", rx6.id, -7,
            )
        if "Омепразол" in inventory_map:
            add_log(
                inventory_map["Омепразол"][0], InventoryOperationType.DISPENSE,
                -5, "Выдача по рецепту: гастропротекция",
                "prescription", rx6.id, -7,
            )
        if "Цефтриаксон" in inventory_map:
            add_log(
                inventory_map["Цефтриаксон"][0], InventoryOperationType.DISPENSE,
                -14, "Выдача по рецепту: антибиотикотерапия",
                "prescription", rx7.id, -14,
            )
        if "Парацетамол" in inventory_map:
            add_log(
                inventory_map["Парацетамол"][0], InventoryOperationType.DISPENSE,
                -28, "Выдача по рецепту: жаропонижающее",
                "prescription", rx7.id, -14,
            )
        if "Амлодипин" in inventory_map:
            add_log(
                inventory_map["Амлодипин"][0], InventoryOperationType.DISPENSE,
                -30, "Выдача по рецепту: гипотензивная терапия",
                "prescription", rx8.id, -5,
            )

        # WRITE_OFF logs — expired drugs
        if "Лозартан" in inventory_map and len(inventory_map["Лозартан"]) > 1:
            add_log(
                inventory_map["Лозартан"][1], InventoryOperationType.WRITE_OFF,
                -35, "Списание просроченной партии LOT-2026-ЛОЗ-002. Срок годности истёк.",
                None, None, -2,
            )
        if "Цефтриаксон" in inventory_map and len(inventory_map["Цефтриаксон"]) > 1:
            add_log(
                inventory_map["Цефтриаксон"][1], InventoryOperationType.WRITE_OFF,
                -15, "Списание просроченной партии LOT-2026-ЦЕФ-002. Истёк срок годности.",
                None, None, -1,
            )

        # Additional WRITE_OFF for damaged stock
        if "Ибупрофен" in inventory_map:
            add_log(
                inventory_map["Ибупрофен"][1], InventoryOperationType.WRITE_OFF,
                -5, "Списание: повреждённая упаковка при транспортировке",
                None, None, -8,
            )

        # ADJUSTMENT logs — inventory corrections
        if "Варфарин" in inventory_map:
            add_log(
                inventory_map["Варфарин"][0], InventoryOperationType.ADJUSTMENT,
                -2, "Коррекция: пересчёт остатков, недостача 2 уп.",
                None, None, -4,
            )
        if "Метформин" in inventory_map:
            add_log(
                inventory_map["Метформин"][0], InventoryOperationType.ADJUSTMENT,
                +5, "Коррекция: обнаружен излишек при инвентаризации",
                None, None, -6,
            )

        # Extra RECEIPT logs spread over last 30 days for richer history
        if "Ибупрофен" in inventory_map:
            add_log(
                inventory_map["Ибупрофен"][0], InventoryOperationType.RECEIPT,
                200, "Приёмка от ФармЛогистик — плановая поставка",
                None, None, -25,
            )
        if "Амоксициллин" in inventory_map:
            add_log(
                inventory_map["Амоксициллин"][0], InventoryOperationType.RECEIPT,
                100, "Приёмка от МедИмпорт — срочная поставка",
                None, None, -18,
            )
        if "Аспирин" in inventory_map:
            add_log(
                inventory_map["Аспирин"][1], InventoryOperationType.RECEIPT,
                80, "Приёмка от ФармЛогистик — дополнительная партия",
                None, None, -15,
            )

        # Extra DISPENSE logs for variety
        if "Аспирин" in inventory_map:
            add_log(
                inventory_map["Аспирин"][0], InventoryOperationType.DISPENSE,
                -10, "Выдача по рецепту: профилактика тромбозов",
                None, None, -12,
            )
        if "Бисопролол" in inventory_map:
            add_log(
                inventory_map["Бисопролол"][0], InventoryOperationType.DISPENSE,
                -30, "Выдача по рецепту: бета-блокатор, месячный курс",
                None, None, -9,
            )
        if "Эналаприл" in inventory_map:
            add_log(
                inventory_map["Эналаприл"][0], InventoryOperationType.DISPENSE,
                -60, "Выдача по рецепту: АПФ-ингибитор",
                None, None, -11,
            )
        if "Варфарин" in inventory_map:
            add_log(
                inventory_map["Варфарин"][0], InventoryOperationType.DISPENSE,
                -30, "Выдача по рецепту: антикоагулянт",
                None, None, -16,
            )

        await s.flush()
        print(f"  Seeded {log_count} inventory log entries")

        # ── Commit ───────────────────────────────────────────────────────── #
        await s.commit()
        print()
        print("=" * 60)
        print("Pharmacy seed complete!")
        print(f"  Suppliers:         {len(suppliers)}")
        print(f"  Inventory batches: {len(all_batches)}")
        print(f"  Purchase orders:   {len(po_list)}")
        print(f"  Prescriptions:     {len(rx_list)}")
        print(f"  Prescription items:{len(rx_items_all)}")
        print(f"  Dispense records:  {len(dispense_records)}")
        print(f"  Inventory logs:    {log_count}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
