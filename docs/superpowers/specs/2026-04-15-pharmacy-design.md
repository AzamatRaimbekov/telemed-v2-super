# Pharmacy Module Design (Аптека)

## Overview
Full pharmacy module with warehouse cycle: procurement → receiving → inventory tracking → dispensing by prescriptions → write-offs. Access controlled via existing RBAC system. Batch tracking with FIFO dispensing.

## Pages & Navigation
New route `/pharmacy` in staff interface with 5 tabs:
- Dashboard, Inventory, Dispensing, Purchase Orders, Suppliers

---

## 1. Dashboard
**KPI Cards (top row):**
- Total unique drugs in stock
- Total stock value (sum of quantity × purchase_price per batch)
- Prescriptions awaiting dispensing (status=ACTIVE)
- Expired batches count
- Critical low stock count (quantity ≤ threshold)

**Alerts Block:**
- Red: expired batches, zero stock for prescribed drugs
- Yellow: expiry < 30 days, stock below threshold
- Blue: new prescriptions to dispense, received orders

**Recent Operations:** feed of last 10 inventory_log entries (dispense, receipt, write-off, adjustment).

---

## 2. Inventory (Склад)

**Main Table** — drugs aggregated across batches:
| Column | Description |
|--------|-------------|
| Name | Drug name |
| Form | TABLET, CAPSULE, etc. |
| Category | Drug category |
| Total Qty | Sum across all batches |
| Min Threshold | low_stock_threshold |
| Nearest Expiry | Min expiry_date across batches |
| Status | Green (ok), Yellow (low), Red (out/expired) |

Filters: search by name, category, form, status (all/low/expired).

**Row Expansion** — batches for a specific drug:
| Batch # | Supplier | Qty | Purchase Price | Received Date | Expiry Date | Actions |
Batch actions: adjust quantity (with reason), write-off batch.

**Operations:**
- **Write-off**: select batch, quantity, reason (EXPIRED, DAMAGED, LOST, OTHER)
- **Adjustment**: manual quantity change with mandatory comment (for inventory audits)
- All operations logged to `inventory_log`

---

## 3. Dispensing (Выдача по рецептам)

**Prescription Queue** — table of ACTIVE prescriptions:
| Patient | Doctor | Date | Items Count | Actions |
Filters: all / today / this week, search by patient name.
Sort: newest first.

**Dispense Modal:**
- Header: patient name, doctor, prescription date
- Items table:
  | Drug | Dosage | Qty to Dispense | Available Stock | Batch (auto FIFO) | Status |
  - FIFO: auto-selects batch with nearest expiry
  - If insufficient stock — red highlight, partial dispense allowed
- "Confirm Dispense" button atomically:
  1. Deducts quantity from batches (FIFO order)
  2. Creates `inventory_log` records (operation_type=DISPENSE)
  3. Creates `dispense_record` entries
  4. Updates prescription status to DISPENSED or PARTIALLY_DISPENSED

---

## 4. Purchase Orders (Закупки)

**Orders Table:**
| Order # | Supplier | Date | Total Amount | Status | Actions |
Statuses: DRAFT → SUBMITTED → RECEIVED / CANCELLED
Filters: status, supplier, date range.

**Create Order:**
- Select supplier from directory
- Add items: drug (from catalog) + quantity + unit price
- Auto-suggest: drugs below threshold highlighted, suggested qty = threshold − current stock
- Save as DRAFT, submit (→ SUBMITTED)

**Receive Order** — "Accept Delivery" button:
- For each item: actual quantity, batch number, expiry date
- Partial receipt supported (discrepancy recorded)
- On confirm atomically:
  1. Creates Inventory records (new batches)
  2. Creates `inventory_log` records (operation_type=RECEIPT)
  3. Sets quantity_received on PurchaseOrderItem
  4. Order status → RECEIVED

---

## 5. Suppliers (Поставщики)

Simple CRUD table:
| Name | Contact Person | Phone | Email | Orders Count | Actions |
Search by name. Create/edit in modal.
Cannot delete if linked orders exist — deactivate instead.

---

## New Database Models

### InventoryLog
```
id, clinic_id, inventory_id (FK→Inventory),
operation_type: RECEIPT | DISPENSE | WRITE_OFF | ADJUSTMENT,
quantity_change: int (positive or negative),
reason: str (nullable),
reference_type: str (nullable — 'prescription', 'purchase_order'),
reference_id: UUID (nullable),
performed_by: UUID (FK→User),
created_at
```

### DispenseRecord
```
id, clinic_id,
prescription_item_id (FK→PrescriptionItem),
inventory_id (FK→Inventory — specific batch),
quantity: int,
dispensed_by: UUID (FK→User),
dispensed_at: datetime
```

### PurchaseOrderItem
```
id, clinic_id,
purchase_order_id (FK→PurchaseOrder),
drug_id (FK→Drug),
quantity_ordered: int,
quantity_received: int (default 0),
unit_price: Decimal
```
Replaces the current `items` JSON field on PurchaseOrder.

## Model Changes

### PrescriptionStatus enum
Add: `PARTIALLY_DISPENSED`

### PurchaseOrder model
- Remove `items` JSON field
- Add `notes` text field
- Add relationship to PurchaseOrderItem collection

### Notification types
Add to NotificationType enum:
- LOW_STOCK
- EXPIRING_BATCH
- EXPIRED_BATCH
- NEW_PRESCRIPTION
- ORDER_RECEIVED

---

## API Endpoints

### Pharmacy Dashboard
- `GET /pharmacy/dashboard` — KPI stats, alerts, recent operations

### Inventory
- `GET /pharmacy/inventory` — list drugs with aggregated stock (search, category, form, status filters)
- `GET /pharmacy/inventory/{drug_id}/batches` — list batches for a drug
- `POST /pharmacy/inventory/write-off` — write off batch (inventory_id, quantity, reason)
- `POST /pharmacy/inventory/adjust` — adjust batch quantity (inventory_id, quantity, reason)

### Dispensing
- `GET /pharmacy/prescriptions` — active prescriptions queue (search, date filter)
- `GET /pharmacy/prescriptions/{id}` — prescription detail with items and stock availability
- `POST /pharmacy/prescriptions/{id}/dispense` — dispense items (array of {item_id, quantity, inventory_id?})

### Purchase Orders
- `GET /pharmacy/orders` — list orders (status, supplier, date filters)
- `GET /pharmacy/orders/{id}` — order detail with items
- `POST /pharmacy/orders` — create order (supplier_id, items[], notes)
- `PATCH /pharmacy/orders/{id}` — update draft order
- `POST /pharmacy/orders/{id}/submit` — submit order
- `POST /pharmacy/orders/{id}/receive` — receive delivery (items with actual qty, batch_number, expiry_date)
- `POST /pharmacy/orders/{id}/cancel` — cancel order

### Suppliers
- `GET /pharmacy/suppliers` — list suppliers (search)
- `POST /pharmacy/suppliers` — create supplier
- `PATCH /pharmacy/suppliers/{id}` — update supplier
- `DELETE /pharmacy/suppliers/{id}` — delete/deactivate supplier
