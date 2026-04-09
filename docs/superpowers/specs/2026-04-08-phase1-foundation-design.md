# Phase 1: Foundation — Infrastructure, Database, Auth

## Overview

Build the complete infrastructure layer, full database schema (all 50+ tables), authentication system with 9 roles, and frontend scaffolding for MedCore KG — a multi-tenant SaaS Hospital Management System for clinics in Kyrgyzstan.

This phase produces: a running Docker Compose stack, a fully migrated database, working JWT auth with role-based guards, and a frontend shell with login flow.

---

## 1. Project Structure

```
medcore-kg/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app factory
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py                # Shared dependencies (get_db, get_current_user, etc.)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py          # Aggregates all v1 routes
│   │   │       └── routes/
│   │   │           ├── __init__.py
│   │   │           ├── auth.py
│   │   │           ├── users.py
│   │   │           ├── clinics.py
│   │   │           └── health.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # Pydantic Settings
│   │   │   ├── security.py            # JWT, password hashing
│   │   │   ├── database.py            # Async engine, session factory
│   │   │   ├── redis.py               # Redis connection pool
│   │   │   ├── exceptions.py          # APIError hierarchy
│   │   │   ├── middleware.py           # Tenant context, request logging
│   │   │   └── logging.py             # Structured JSON logging
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                # Base model with id, timestamps, clinic_id, is_deleted
│   │   │   ├── clinic.py
│   │   │   ├── user.py
│   │   │   ├── patient.py
│   │   │   ├── medical.py             # medical_cards, visits, diagnoses
│   │   │   ├── treatment.py           # treatment_plans, treatment_plan_items
│   │   │   ├── medication.py          # drugs, prescriptions, prescription_items, inventory
│   │   │   ├── laboratory.py          # lab_tests_catalog, lab_orders, lab_results
│   │   │   ├── procedure.py           # procedures, procedure_orders
│   │   │   ├── exercise.py            # exercises, exercise_sessions, exercise_reps
│   │   │   ├── staff.py               # staff_schedules, shifts, attendance
│   │   │   ├── billing.py             # invoices, invoice_items, payments
│   │   │   ├── appointment.py         # appointments
│   │   │   ├── notification.py        # notifications
│   │   │   ├── stroke.py              # stroke_assessments, rehab_goals, rehab_progress
│   │   │   ├── facility.py            # departments, rooms, beds, bed_assignments
│   │   │   ├── telemedicine.py        # telemedicine_sessions, messages
│   │   │   ├── face.py                # face_snapshots, face_embeddings
│   │   │   └── audit.py               # audit_logs
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── clinic.py
│   │   │   ├── common.py              # Pagination, error responses
│   │   │   └── ... (one per domain, added in later phases)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   └── clinic.py
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                # Generic CRUD repository
│   │   │   ├── user.py
│   │   │   └── clinic.py
│   │   └── tasks/
│   │       ├── __init__.py
│   │       └── celery_app.py          # Celery configuration
│   ├── alembic/
│   │   ├── env.py
│   │   ├── alembic.ini
│   │   └── versions/
│   ├── tests/
│   │   └── __init__.py
│   ├── seed.py                        # Demo data seeder
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── __root.tsx
│   │   │   ├── login.tsx
│   │   │   ├── _authenticated.tsx     # Auth layout guard
│   │   │   ├── _authenticated/
│   │   │   │   └── dashboard.tsx
│   │   │   └── ... (route files added per phase)
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   └── shared/
│   │   │       ├── loading-skeleton.tsx
│   │   │       ├── error-boundary.tsx
│   │   │       └── page-header.tsx
│   │   ├── features/
│   │   │   └── auth/
│   │   │       ├── components/
│   │   │       │   └── login-form.tsx
│   │   │       ├── hooks/
│   │   │       │   └── use-auth.ts
│   │   │       └── api.ts
│   │   ├── stores/
│   │   │   └── auth-store.ts          # Zustand auth state
│   │   ├── hooks/
│   │   │   └── use-toast.ts
│   │   ├── lib/
│   │   │   ├── api-client.ts          # Axios instance + interceptors
│   │   │   ├── query-client.ts        # TanStack Query config
│   │   │   └── utils.ts               # cn(), formatDate, formatCurrency
│   │   └── types/
│   │       ├── auth.ts
│   │       └── api.ts                 # APIError, PaginatedResponse, etc.
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── components.json               # shadcn/ui config
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── .gitignore
```

---

## 2. Docker Compose Stack

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Primary database |
| redis | redis:7-alpine | 6379 | Cache, sessions, token blacklist, Celery broker |
| minio | minio/minio | 9000/9001 | File/image storage (S3-compatible) |
| backend | custom Dockerfile | 8000 | FastAPI (uvicorn) |
| frontend | custom Dockerfile | 5173 | Vite dev server |
| nginx | nginx:alpine | 80/443 | Reverse proxy |
| celery-worker | same as backend | — | Background task processor |
| celery-beat | same as backend | — | Scheduled task scheduler |

### Key Configuration

- PostgreSQL: `pool_size=20, max_overflow=10` via asyncpg
- Redis: connection pool, separate DBs for cache (0), sessions (1), celery (2)
- MinIO: auto-create `medcore` bucket on startup
- Nginx: proxy `/api` → backend:8000, `/` → frontend:5173, gzip, CORS headers
- All services share `.env` file
- Health checks on postgres, redis, backend

---

## 3. Database Schema

### Base Model (all tables inherit)

```python
id: UUID (pk, default=uuid4)
created_at: datetime (server_default=now())
updated_at: datetime (onupdate=now())
clinic_id: UUID (FK → clinics.id, indexed)
is_deleted: bool (default=False)
```

Exception: `clinics` table has no `clinic_id`. `super_admin` users may have `clinic_id=NULL`.

### Table Definitions

#### Core

**clinics**
- name: str (not null)
- slug: str (unique, not null)
- logo_url: str (nullable)
- address: str
- phone: str
- email: str
- working_hours: JSON (e.g. {"mon": ["09:00", "18:00"], ...})
- subscription_plan: enum (FREE, BASIC, PRO, ENTERPRISE)
- subscription_expires_at: datetime (nullable)
- is_active: bool (default=True)
- settings: JSON (feature flags, locale, etc.)

**users**
- email: str (unique, not null, indexed)
- hashed_password: str (not null)
- first_name: str
- last_name: str
- middle_name: str (nullable)
- phone: str (nullable)
- role: enum (SUPER_ADMIN, CLINIC_ADMIN, DOCTOR, NURSE, PHARMACIST, RECEPTIONIST, LAB_TECHNICIAN, PATIENT, GUARDIAN)
- avatar_url: str (nullable)
- specialization: str (nullable, for doctors)
- department_id: UUID (FK → departments.id, nullable)
- is_active: bool (default=True)
- last_login_at: datetime (nullable)

**roles** (for future fine-grained RBAC)
- name: str (unique)
- description: str

**permissions**
- name: str (unique)
- resource: str
- action: enum (CREATE, READ, UPDATE, DELETE, MANAGE)

**role_permissions** (junction)
- role_id: UUID (FK → roles.id)
- permission_id: UUID (FK → permissions.id)

#### Patient Domain

**patients**
- user_id: UUID (FK → users.id, nullable — not all patients have portal accounts)
- first_name: str
- last_name: str
- middle_name: str (nullable)
- date_of_birth: date
- gender: enum (MALE, FEMALE, OTHER)
- passport_number: str (nullable, indexed)
- inn: str (nullable, indexed)
- address: text
- phone: str
- emergency_contact_name: str (nullable)
- emergency_contact_phone: str (nullable)
- blood_type: enum (A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG, UNKNOWN)
- allergies: JSON (array of strings)
- chronic_conditions: JSON (array of strings)
- insurance_provider: str (nullable)
- insurance_number: str (nullable)
- assigned_doctor_id: UUID (FK → users.id, nullable)
- assigned_nurse_id: UUID (FK → users.id, nullable)
- photo_url: str (nullable)
- registration_source: enum (WALK_IN, ONLINE, REFERRAL, EMERGENCY)
- status: enum (ACTIVE, DISCHARGED, DECEASED, TRANSFERRED)

**patient_guardians**
- patient_id: UUID (FK → patients.id)
- guardian_user_id: UUID (FK → users.id)
- relationship: str (e.g. "parent", "spouse", "child")

**medical_cards**
- patient_id: UUID (FK → patients.id, unique)
- card_number: str (unique, auto-generated: MC-{clinic_slug}-{seq})
- opened_at: datetime
- notes: text (nullable)

#### Visits & Diagnosis

**visits**
- patient_id: UUID (FK → patients.id)
- doctor_id: UUID (FK → users.id)
- medical_card_id: UUID (FK → medical_cards.id)
- visit_type: enum (CONSULTATION, FOLLOW_UP, EMERGENCY, TELEMEDICINE, PROCEDURE)
- status: enum (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
- chief_complaint: text
- examination_notes: text (nullable)
- diagnosis_codes: JSON (array of ICD-10 codes)
- diagnosis_text: text (nullable)
- started_at: datetime
- ended_at: datetime (nullable)

#### Treatment Plans

**treatment_plans**
- patient_id: UUID (FK → patients.id)
- doctor_id: UUID (FK → users.id)
- visit_id: UUID (FK → visits.id, nullable)
- title: str
- description: text (nullable)
- status: enum (DRAFT, ACTIVE, COMPLETED, CANCELLED)
- start_date: date
- end_date: date (nullable)

**treatment_plan_items**
- treatment_plan_id: UUID (FK → treatment_plans.id)
- item_type: enum (MEDICATION, PROCEDURE, LAB_TEST, THERAPY, EXERCISE, DIET, MONITORING)
- title: str
- description: text (nullable)
- configuration: JSON (type-specific data: dosage, frequency, sets/reps, etc.)
- assigned_to_id: UUID (FK → users.id, nullable)
- scheduled_at: datetime (nullable)
- frequency: str (nullable, e.g. "3x/day", "weekly")
- status: enum (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- sort_order: int
- start_date: date
- end_date: date (nullable)

#### Medications & Pharmacy

**drugs**
- name: str (not null)
- generic_name: str
- brand: str (nullable)
- category: str
- form: enum (TABLET, CAPSULE, INJECTION, SYRUP, CREAM, DROPS, INHALER, OTHER)
- unit: str (e.g. "mg", "ml")
- price: decimal
- requires_prescription: bool (default=True)
- interactions: JSON (array of drug_ids that interact)
- contraindications: text (nullable)
- is_active: bool (default=True)

**prescriptions**
- patient_id: UUID (FK → patients.id)
- doctor_id: UUID (FK → users.id)
- visit_id: UUID (FK → visits.id, nullable)
- treatment_plan_id: UUID (FK → treatment_plans.id, nullable)
- status: enum (ACTIVE, DISPENSED, CANCELLED, EXPIRED)
- notes: text (nullable)
- prescribed_at: datetime

**prescription_items**
- prescription_id: UUID (FK → prescriptions.id)
- drug_id: UUID (FK → drugs.id)
- dosage: str (e.g. "500mg")
- frequency: str (e.g. "3x/day")
- route: enum (ORAL, IV, IM, TOPICAL, SUBLINGUAL, RECTAL, INHALATION, OTHER)
- duration_days: int
- quantity: int
- is_prn: bool (default=False)
- notes: str (nullable)

**inventory**
- drug_id: UUID (FK → drugs.id)
- quantity: int
- batch_number: str
- expiry_date: date
- purchase_price: decimal
- supplier_id: UUID (FK → suppliers.id, nullable)
- low_stock_threshold: int (default=10)
- location: str (nullable)

**suppliers**
- name: str
- contact_person: str (nullable)
- phone: str
- email: str (nullable)
- address: text (nullable)

**purchase_orders**
- supplier_id: UUID (FK → suppliers.id)
- ordered_by_id: UUID (FK → users.id)
- status: enum (DRAFT, SUBMITTED, RECEIVED, CANCELLED)
- total_amount: decimal
- items: JSON (array of {drug_id, quantity, unit_price})
- ordered_at: datetime
- received_at: datetime (nullable)

#### Laboratory

**lab_tests_catalog**
- name: str
- code: str (unique)
- category: str (e.g. "Hematology", "Biochemistry", "Imaging")
- description: text (nullable)
- reference_ranges: JSON (e.g. {"min": 4.0, "max": 11.0, "unit": "10^9/L"})
- price: decimal
- turnaround_hours: int
- sample_type: str (nullable, e.g. "blood", "urine")

**lab_orders**
- patient_id: UUID (FK → patients.id)
- ordered_by_id: UUID (FK → users.id)
- treatment_plan_id: UUID (FK → treatment_plans.id, nullable)
- test_id: UUID (FK → lab_tests_catalog.id)
- priority: enum (ROUTINE, URGENT, STAT)
- status: enum (ORDERED, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED)
- notes: text (nullable)
- expected_at: datetime (nullable)
- collected_at: datetime (nullable)
- collected_by_id: UUID (FK → users.id, nullable)

**lab_results**
- lab_order_id: UUID (FK → lab_orders.id)
- performed_by_id: UUID (FK → users.id)
- approved_by_id: UUID (FK → users.id, nullable)
- value: str
- numeric_value: decimal (nullable)
- unit: str (nullable)
- reference_range: str (nullable)
- is_abnormal: bool (default=False)
- notes: text (nullable)
- attachment_url: str (nullable)
- status: enum (PRELIMINARY, FINAL, AMENDED)
- resulted_at: datetime
- approved_at: datetime (nullable)

#### Procedures

**procedures** (catalog)
- name: str
- code: str
- category: str
- description: text (nullable)
- duration_minutes: int
- price: decimal
- requires_consent: bool (default=False)

**procedure_orders**
- patient_id: UUID (FK → patients.id)
- procedure_id: UUID (FK → procedures.id)
- ordered_by_id: UUID (FK → users.id)
- performed_by_id: UUID (FK → users.id, nullable)
- treatment_plan_id: UUID (FK → treatment_plans.id, nullable)
- status: enum (ORDERED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)
- scheduled_at: datetime (nullable)
- started_at: datetime (nullable)
- completed_at: datetime (nullable)
- notes: text (nullable)
- consent_signed: bool (default=False)

#### Exercises (MediaPipe)

**exercises** (library)
- name: str
- description: text
- category: enum (UPPER_LIMB, LOWER_LIMB, BALANCE, GAIT, COGNITIVE)
- difficulty: enum (EASY, MEDIUM, HARD)
- target_joints: JSON (array of joint names for MediaPipe)
- angle_thresholds: JSON (e.g. {"shoulder_flexion": {"start": 0, "end": 160}})
- demo_video_url: str (nullable)
- instructions: text
- default_sets: int
- default_reps: int
- is_active: bool (default=True)

**exercise_sessions**
- patient_id: UUID (FK → patients.id)
- exercise_id: UUID (FK → exercises.id)
- treatment_plan_item_id: UUID (FK → treatment_plan_items.id, nullable)
- duration_seconds: int
- reps_completed: int
- sets_completed: int
- accuracy_score: decimal (0-100)
- feedback: JSON (array of feedback messages generated)
- started_at: datetime
- completed_at: datetime (nullable)

**exercise_reps**
- session_id: UUID (FK → exercise_sessions.id)
- rep_number: int
- max_angle: decimal
- min_angle: decimal
- duration_ms: int
- form_score: decimal (0-100)
- feedback: str (nullable)

#### Staff Management

**staff_schedules**
- user_id: UUID (FK → users.id)
- day_of_week: int (0=Monday)
- start_time: time
- end_time: time
- is_available: bool (default=True)

**shifts**
- user_id: UUID (FK → users.id)
- shift_date: date
- start_time: time
- end_time: time
- shift_type: enum (MORNING, AFTERNOON, NIGHT, ON_CALL)
- status: enum (SCHEDULED, ACTIVE, COMPLETED, ABSENT)

**attendance**
- user_id: UUID (FK → users.id)
- clock_in: datetime
- clock_out: datetime (nullable)
- qr_code: str (nullable)
- hours_worked: decimal (nullable, computed)

#### Billing & Finance

**invoices**
- patient_id: UUID (FK → patients.id)
- visit_id: UUID (FK → visits.id, nullable)
- treatment_plan_id: UUID (FK → treatment_plans.id, nullable)
- invoice_number: str (unique, auto-generated)
- status: enum (DRAFT, ISSUED, PAID, PARTIALLY_PAID, CANCELLED, OVERDUE)
- subtotal: decimal
- discount: decimal (default=0)
- tax: decimal (default=0)
- total: decimal
- insurance_claim_amount: decimal (default=0)
- insurance_claim_status: enum (NONE, SUBMITTED, APPROVED, REJECTED, nullable)
- foms_claim_number: str (nullable)
- due_date: date (nullable)
- notes: text (nullable)
- issued_at: datetime

**invoice_items**
- invoice_id: UUID (FK → invoices.id)
- item_type: enum (CONSULTATION, PROCEDURE, LAB_TEST, MEDICATION, ROOM, OTHER)
- description: str
- quantity: int
- unit_price: decimal
- total_price: decimal
- reference_id: UUID (nullable — FK to the source: visit, procedure_order, lab_order, etc.)

**payments**
- invoice_id: UUID (FK → invoices.id)
- amount: decimal
- payment_method: enum (CASH, CARD, INSURANCE, BANK_TRANSFER, OTHER)
- reference_number: str (nullable)
- paid_at: datetime
- received_by_id: UUID (FK → users.id)

#### Appointments

**appointments**
- patient_id: UUID (FK → patients.id)
- doctor_id: UUID (FK → users.id)
- appointment_type: enum (CONSULTATION, FOLLOW_UP, PROCEDURE, TELEMEDICINE)
- status: enum (SCHEDULED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
- scheduled_start: datetime
- scheduled_end: datetime
- actual_start: datetime (nullable)
- actual_end: datetime (nullable)
- reason: text (nullable)
- notes: text (nullable)
- is_walk_in: bool (default=False)
- queue_number: int (nullable)

#### Notifications

**notifications**
- user_id: UUID (FK → users.id)
- type: enum (PATIENT_ASSIGNED, LAB_RESULT_READY, MEDICATION_DUE, APPOINTMENT_REMINDER, LOW_STOCK, TREATMENT_UPDATED, ABNORMAL_RESULT, ALLERGY_ALERT, SYSTEM)
- title: str
- message: text
- severity: enum (INFO, WARNING, CRITICAL)
- is_read: bool (default=False)
- read_at: datetime (nullable)
- reference_type: str (nullable, e.g. "patient", "lab_order")
- reference_id: UUID (nullable)
- data: JSON (nullable, additional context)

#### Stroke Rehabilitation

**stroke_assessments**
- patient_id: UUID (FK → patients.id)
- assessed_by_id: UUID (FK → users.id)
- assessment_type: enum (NIHSS, MRS, BARTHEL, MMSE, BECK_DEPRESSION, DYSPHAGIA)
- score: decimal
- max_score: decimal
- responses: JSON (individual item scores)
- interpretation: str (nullable)
- assessed_at: datetime
- notes: text (nullable)

**rehab_goals**
- patient_id: UUID (FK → patients.id)
- treatment_plan_id: UUID (FK → treatment_plans.id, nullable)
- domain: enum (MOBILITY, SPEECH, COGNITION, ADL, PSYCHOLOGICAL, SOCIAL)
- description: text
- target_date: date
- baseline_value: str (nullable)
- target_value: str
- current_value: str (nullable)
- status: enum (ACTIVE, ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED, REVISED)
- set_by_id: UUID (FK → users.id)

**rehab_progress**
- goal_id: UUID (FK → rehab_goals.id)
- recorded_by_id: UUID (FK → users.id)
- value: str
- notes: text (nullable)
- recorded_at: datetime

#### Facility

**departments**
- name: str
- code: str
- description: text (nullable)
- head_id: UUID (FK → users.id, nullable)
- is_active: bool (default=True)

**rooms**
- department_id: UUID (FK → departments.id)
- name: str
- room_number: str
- room_type: enum (CONSULTATION, WARD, ICU, OPERATING, LAB, PHARMACY, RECEPTION, OTHER)
- capacity: int (default=1)
- floor: int
- is_active: bool (default=True)

**beds**
- room_id: UUID (FK → rooms.id)
- bed_number: str
- status: enum (AVAILABLE, OCCUPIED, MAINTENANCE, RESERVED)

**bed_assignments**
- bed_id: UUID (FK → beds.id)
- patient_id: UUID (FK → patients.id)
- assigned_at: datetime
- discharged_at: datetime (nullable)
- notes: text (nullable)

#### Telemedicine

**telemedicine_sessions**
- patient_id: UUID (FK → patients.id)
- doctor_id: UUID (FK → users.id)
- appointment_id: UUID (FK → appointments.id, nullable)
- visit_id: UUID (FK → visits.id, nullable)
- room_id: str (unique session room identifier)
- status: enum (WAITING, ACTIVE, COMPLETED, CANCELLED)
- started_at: datetime (nullable)
- ended_at: datetime (nullable)
- duration_seconds: int (nullable)
- patient_questionnaire: JSON (nullable)
- doctor_notes: text (nullable)

**messages**
- sender_id: UUID (FK → users.id)
- recipient_id: UUID (FK → users.id)
- patient_id: UUID (FK → patients.id, nullable — for context)
- content: text
- is_read: bool (default=False)
- read_at: datetime (nullable)
- attachment_url: str (nullable)

#### Face Detection

**face_snapshots**
- patient_id: UUID (FK → patients.id, nullable — null until linked)
- captured_at: datetime
- image_url: str
- source: enum (CAMERA, UPLOAD, PASSPORT)
- confidence: decimal (nullable)

**face_embeddings**
- patient_id: UUID (FK → patients.id)
- face_snapshot_id: UUID (FK → face_snapshots.id)
- embedding: JSON (128-dimensional vector)
- model_version: str

#### Audit

**audit_logs**
- user_id: UUID (FK → users.id, nullable)
- action: str (e.g. "patient.create", "prescription.update")
- resource_type: str
- resource_id: UUID (nullable)
- old_values: JSON (nullable)
- new_values: JSON (nullable)
- ip_address: str (nullable)
- user_agent: str (nullable)

### Indexes

- All `clinic_id` columns: B-tree index
- `users.email`: unique index
- `patients.passport_number`: index per clinic
- `patients.inn`: index per clinic
- `appointments.scheduled_start`: index per clinic + doctor
- `notifications.user_id + is_read`: composite index
- `audit_logs.user_id + created_at`: composite index
- `lab_orders.status + priority`: composite index
- `invoices.status`: index per clinic
- `medical_cards.card_number`: unique index

---

## 4. Authentication & Authorization

### JWT Flow

1. **Login** (`POST /api/v1/auth/login`): email + password → validate → issue access_token (30min) + refresh_token (7 days)
2. **Refresh** (`POST /api/v1/auth/refresh`): validate refresh_token not in Redis blacklist → issue new pair → blacklist old refresh_token
3. **Logout** (`POST /api/v1/auth/logout`): blacklist both tokens in Redis (TTL = remaining token lifetime)
4. **Me** (`GET /api/v1/auth/me`): returns current user profile + permissions

### Token Structure

```json
{
  "sub": "user_uuid",
  "role": "DOCTOR",
  "clinic_id": "clinic_uuid",
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "unique_token_id"
}
```

### Role Hierarchy & Permissions

| Role | Scope | Key Permissions |
|------|-------|----------------|
| SUPER_ADMIN | All clinics | Everything. Manage clinics, users, system settings |
| CLINIC_ADMIN | Own clinic | Manage staff, settings, view all data, reports |
| DOCTOR | Own clinic | Patients (own), treatment plans, prescriptions, orders |
| NURSE | Own clinic | Patients (assigned), vitals, procedure execution, medication admin |
| PHARMACIST | Own clinic | Drug inventory, dispensing, purchase orders |
| RECEPTIONIST | Own clinic | Patient registration, appointments, face detection, billing |
| LAB_TECHNICIAN | Own clinic | Lab orders queue, enter results, manage samples |
| PATIENT | Own data | View own medical card, results, appointments, exercises |
| GUARDIAN | Linked patient data | Same as PATIENT for linked patients |

### Multi-Tenancy Enforcement

- Middleware extracts `clinic_id` from JWT on every request
- All repository queries automatically filter by `clinic_id`
- SUPER_ADMIN can pass `X-Clinic-Id` header to act on any clinic
- Cross-clinic data access is impossible at the repository level

### FastAPI Dependencies

```python
# deps.py
get_db()          → AsyncSession
get_current_user() → User (validates JWT)
get_current_active_user() → User (+ checks is_active)
require_role(*roles) → dependency factory that checks user.role
require_clinic_access() → ensures user belongs to requested clinic
```

---

## 5. Backend Core Architecture

### Exception Hierarchy

```python
class APIError(Exception):
    status_code: int
    error_code: str
    message: str
    details: dict | None

class NotFoundError(APIError): ...       # 404
class ValidationError(APIError): ...     # 422
class AuthenticationError(APIError): ... # 401
class ForbiddenError(APIError): ...      # 403
class ConflictError(APIError): ...       # 409
class RateLimitError(APIError): ...      # 429
```

Global exception handler returns:
```json
{
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with id xxx not found",
    "details": {}
  }
}
```

### Repository Pattern

```python
class BaseRepository(Generic[ModelType]):
    async def get_by_id(id, clinic_id) → ModelType | None
    async def get_multi(clinic_id, skip, limit, filters, sort) → list[ModelType]
    async def create(obj_in, clinic_id) → ModelType
    async def update(id, obj_in, clinic_id) → ModelType
    async def soft_delete(id, clinic_id) → None
    async def count(clinic_id, filters) → int
```

### Pagination (Cursor-based)

```json
{
  "items": [...],
  "next_cursor": "base64_encoded_cursor",
  "has_more": true,
  "total": 150
}
```

### Request/Response Logging

Middleware logs every request as structured JSON:
```json
{
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/v1/patients",
  "user_id": "uuid",
  "clinic_id": "uuid",
  "status_code": 201,
  "duration_ms": 45,
  "timestamp": "2026-04-08T12:00:00Z"
}
```

### Health Checks

- `GET /api/v1/health` → `{"status": "ok"}`
- `GET /api/v1/health/db` → tests DB connection
- `GET /api/v1/health/redis` → tests Redis connection

---

## 6. Frontend Architecture

### Tailwind Config (Color System)

```typescript
// CSS variables in :root
--color-primary: #BDEDE0
--color-secondary: #7E78D2
--color-background: #F8FFFE
--color-surface: #FFFFFF
--color-text-primary: #1A1A2E
--color-text-secondary: #6B7280
--color-danger: #EF4444
--color-warning: #F59E0B
--color-success: #10B981

// Dark mode overrides in .dark
--color-background: #0F1117
--color-surface: #1A1D2E
--color-text-primary: #F1F5F9
--color-text-secondary: #94A3B8
```

### API Client

```typescript
// Axios instance with:
// - baseURL: /api/v1
// - Request interceptor: attach Authorization header from auth store
// - Response interceptor: on 401, attempt token refresh, retry original request
// - On refresh failure, redirect to /login
// - All errors normalized to APIError type
```

### Auth Store (Zustand)

```typescript
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: User) => void
}
```

### Route Guards

- `_authenticated.tsx` layout route checks `isAuthenticated` from Zustand store
- Redirects to `/login` if not authenticated
- Role-based guards as wrapper components: `<RequireRole roles={["DOCTOR", "NURSE"]}>`

### shadcn/ui Components to Install

For Phase 1: button, input, label, card, form, toast (sonner), dropdown-menu, avatar, separator, skeleton, alert

---

## 7. Seed Script

Creates:
- 1 super_admin (admin@medcore.kg / Admin123!)
- 1 demo clinic ("Бишкек Мед Центр", slug: bishkek-med)
- 1 clinic_admin
- 2 doctors (therapist, neurologist)
- 1 nurse
- 1 receptionist
- 1 pharmacist
- 1 lab_technician
- 5 demo patients with medical cards
- Sample departments (Therapy, Neurology, Emergency, Pharmacy, Laboratory)
- Sample rooms and beds

---

## 8. Environment Variables (.env.example)

```bash
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=medcore
POSTGRES_USER=medcore
POSTGRES_PASSWORD=medcore_secret

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET_KEY=change-me-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_ALGORITHM=HS256

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=medcore

# Celery
CELERY_BROKER_URL=redis://redis:6379/2
CELERY_RESULT_BACKEND=redis://redis:6379/2

# App
APP_NAME=MedCore KG
APP_ENV=development
APP_DEBUG=true
CORS_ORIGINS=http://localhost:5173,http://localhost:80

# Sentry (optional)
SENTRY_DSN=
```

---

## 9. What Phase 1 Delivers

After this phase is complete, we have:
1. `docker-compose up` brings up the entire stack
2. All 50+ database tables created via Alembic migration
3. Working auth: login, logout, refresh, me endpoints
4. Role-based route protection on backend
5. Health check endpoints
6. Frontend: login page, auth flow, dashboard shell, route guards
7. Seed data for immediate testing
8. Typed API client ready for all future modules

---

## 10. Out of Scope for Phase 1

- Patient registration UI (Phase 2)
- OCR / Face detection (Phase 2)
- Medical card UI (Phase 2)
- Treatment plans (Phase 2)
- All other module UIs (Phase 3-6)
- Telemedicine (Phase 5)
- MediaPipe (Phase 3)
