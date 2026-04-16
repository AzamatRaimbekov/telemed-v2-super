# ТЗ — URL-роутинг карточки + История болезни с ИИ + История палат
## MedCore KG · Patient Card Extended · v1.1

## 1. URL-роутинг — каждая вкладка = отдельный URL

### Концепция
Каждый раздел карточки живёт по своему URL. Это даёт:
- Кнопку "Назад" в браузере — работает корректно
- Прямые ссылки: скопировал URL → отправил коллеге → он попал ровно на нужную вкладку
- Историю действий в браузере
- Deep linking: из уведомления "Новый результат анализа" ссылка ведёт сразу на /patients/uuid/labs/result-uuid

### Полная карта роутов (TanStack Router, file-based)
```
src/routes/patients/
  $patientId/
    _layout.tsx            ← шапка + вкладки (sticky header, всегда)
    index.tsx              → redirect to ./overview
    overview.tsx           /patients/:patientId/overview
    history/
      index.tsx            /patients/:patientId/history
      $entryId.tsx         /patients/:patientId/history/:entryId
      new.tsx              /patients/:patientId/history/new
    diagnoses/
      index.tsx            /patients/:patientId/diagnoses
      $diagnosisId.tsx     /patients/:patientId/diagnoses/:diagnosisId
    treatment/
      index.tsx            /patients/:patientId/treatment
      $itemId.tsx          /patients/:patientId/treatment/:itemId
    labs/
      index.tsx            /patients/:patientId/labs
      $resultId.tsx        /patients/:patientId/labs/:resultId
    procedures/
      index.tsx            /patients/:patientId/procedures
    medications/
      index.tsx            /patients/:patientId/medications
    stroke/
      index.tsx            /patients/:patientId/stroke
      scales.tsx           /patients/:patientId/stroke/scales
      rehab.tsx            /patients/:patientId/stroke/rehab
      exercises.tsx        /patients/:patientId/stroke/exercises
    rooms/
      index.tsx            /patients/:patientId/rooms
    documents/
      index.tsx            /patients/:patientId/documents
      $documentId.tsx      /patients/:patientId/documents/:documentId
    billing/
      index.tsx            /patients/:patientId/billing
    ai/
      index.tsx            /patients/:patientId/ai
      $conversationId.tsx  /patients/:patientId/ai/:conversationId
```

### Реализация _layout.tsx — шапка + навигация
```tsx
// src/routes/patients/$patientId/_layout.tsx

export const Route = createFileRoute('/patients/$patientId/_layout')({
  loader: async ({ params }) => {
    return queryClient.ensureQueryData(patientSummaryQuery(params.patientId))
  },
  component: PatientCardLayout,
})

const TABS = [
  { path: 'overview',     label: 'Обзор'         },
  { path: 'history',      label: 'История болезни'},
  { path: 'diagnoses',    label: 'Диагнозы'       },
  { path: 'treatment',    label: 'План лечения'   },
  { path: 'labs',         label: 'Анализы'        },
  { path: 'procedures',   label: 'Процедуры'      },
  { path: 'medications',  label: 'Препараты'      },
  { path: 'stroke',       label: 'Инсульт'        },
  { path: 'rooms',        label: 'Палаты'         },
  { path: 'documents',    label: 'Документы'      },
  { path: 'billing',      label: 'Биллинг'        },
  { path: 'ai',           label: 'ИИ Ассистент'   },
]

function PatientCardLayout() {
  const { patientId } = Route.useParams()
  const patient = Route.useLoaderData()

  return (
    <div>
      <div className="sticky top-0 z-50 bg-white border-b">
        <PatientCardHeader patient={patient} />
        <VitalSignsStrip patientId={patientId} />
        <nav className="flex gap-1 px-6 overflow-x-auto">
          {TABS.map(tab => (
            <Link
              key={tab.path}
              to={`/patients/${patientId}/${tab.path}`}
              activeProps={{ className: 'tab-active' }}
              className="tab-btn whitespace-nowrap"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-6">
        <Outlet />
      </div>
    </div>
  )
}
```

### URL query params для фильтров
```
/patients/uuid/history?type=diagnosis&period=3m&author=doctor-uuid
/patients/uuid/labs?status=ready&from=2026-04-01
/patients/uuid/rooms?show=all_hospitalizations=true
```

```tsx
export const Route = createFileRoute('/patients/$patientId/history/')({
  validateSearch: (search) => historyFiltersSchema.parse(search),
  component: HistoryTab,
})

function HistoryTab() {
  const { type, period, author } = Route.useSearch()
  const navigate = useNavigate()

  const setFilter = (key: string, value: string) => {
    navigate({ search: prev => ({ ...prev, [key]: value }) })
  }
}
```

---

## 2. История болезни — полный модуль

### 2.1 Структура записи истории болезни
```sql
CREATE TABLE medical_history_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID REFERENCES patients(id),
    hospitalization_id  UUID REFERENCES hospitalizations(id),
    clinic_id           UUID REFERENCES clinics(id),
    entry_type          VARCHAR(40) NOT NULL,
    title               VARCHAR(200) NOT NULL,
    recorded_at         TIMESTAMP NOT NULL,
    author_id           UUID REFERENCES users(id),
    is_verified         BOOLEAN DEFAULT false,
    source_type         VARCHAR(20),
    source_document_url VARCHAR(500),
    ai_confidence       DECIMAL(3,2),
    content             JSONB NOT NULL,
    linked_diagnosis_id UUID REFERENCES patient_diagnoses(id),
    linked_lab_id       UUID REFERENCES lab_results(id),
    linked_procedure_id UUID REFERENCES procedure_orders(id),
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now(),
    is_deleted          BOOLEAN DEFAULT false
);
```

Entry types:
- initial_exam — первичный осмотр
- daily_note — ежедневная запись врача
- specialist_consult — консультация специалиста
- procedure_note — запись о процедуре
- discharge_summary — выписной эпикриз
- anamnesis — анамнез
- surgery_note — операционная записка
- lab_interpretation — интерпретация анализов
- imaging_description — описание снимка/КТ/МРТ
- ai_generated — сгенерировано ИИ из документа
- manual — ручной ввод

### 2.2 Структура content по типам записей

**initial_exam:**
```json
{
  "chief_complaint": "...",
  "anamnesis_morbi": "...",
  "anamnesis_vitae": {
    "past_illnesses": [], "surgeries": [], "medications": [],
    "allergies": [], "family_history": "", "social_history": "", "alcohol": ""
  },
  "objective_exam": {
    "general_condition": "", "consciousness": "", "skin": "",
    "cardiovascular": "", "respiratory": "", "neurological": "", "other": ""
  },
  "preliminary_diagnosis": "",
  "plan": ""
}
```

**daily_note:**
```json
{
  "date": "YYYY-MM-DD",
  "complaints": "", "dynamics": "", "objective": "",
  "vitals_summary": "", "current_therapy": "", "corrections": "", "plan": ""
}
```

**specialist_consult:**
```json
{
  "specialist_role": "", "specialist_name": "", "consult_date": "",
  "reason": "", "findings": "", "diagnosis": "",
  "recommendations": "", "follow_up": ""
}
```

**imaging_description:**
```json
{
  "modality": "", "body_part": "", "contrast": false,
  "date_performed": "", "performing_doctor": "",
  "description": "", "conclusion": "", "linked_document_id": ""
}
```

**ai_generated:**
```json
{
  "source_document_type": "",
  "extracted_date": "", "extracted_facility": "", "extracted_doctor": "",
  "extracted_diagnosis": "", "extracted_medications": [],
  "extracted_labs": {}, "extracted_recommendations": "",
  "raw_text": "", "ai_notes": "",
  "field_confidence": {}
}
```

### 2.3 UI /patients/:id/history
- Левая колонка (70%) — Таймлайн (хронологический, сгруппирован по дням)
- Правая колонка (30%) — Статистика по типам
- Фильтры: период, тип, автор
- Цветовые индикаторы по типу записи
- ИИ-записи с бейджами уверенности

### 2.4 /patients/:id/history/new — форма добавления
4 метода: ручной ввод, загрузка документа, снимок с камеры, диктовка

---

## 3. ИИ анализ документов

### API: POST /api/v1/ai/analyze-medical-document
- Multipart upload (jpg/png/heic/pdf, max 20MB)
- Загрузка в MinIO
- Вызов Claude API с Vision (base64 + системный промпт)
- Возврат: document_url, entry_type, extracted_data, overall_confidence, ai_notes

### UI при заполнении из ИИ
- Split view: оригинал слева, форма справа
- Поля с confidence > 0.85 — зелёная галочка
- 0.6-0.85 — жёлтый фон "Проверьте"
- < 0.6 — пустые, красная рамка

---

## 4. История палат — /patients/:id/rooms

### БД: room_assignments
```sql
CREATE TABLE room_assignments (
    id UUID PRIMARY KEY,
    patient_id UUID, hospitalization_id UUID, clinic_id UUID,
    department_id UUID, room_id UUID, bed_id UUID,
    placement_type VARCHAR(30),
    assigned_at TIMESTAMP NOT NULL,
    released_at TIMESTAMP,
    duration_minutes INT,
    transfer_reason VARCHAR(200),
    transferred_by UUID,
    condition_on_transfer VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT now()
);
```

### API
```
GET    /api/v1/patients/:id/rooms/current
GET    /api/v1/patients/:id/rooms/history
GET    /api/v1/patients/:id/rooms/all
POST   /api/v1/patients/:id/rooms/transfer
GET    /api/v1/rooms/:roomId/availability
```

### UI
- Текущее местонахождение (большой блок)
- Timeline перемещений (текущая госпитализация)
- Форма перевода в модальном окне
- Аккордеон предыдущих госпитализаций

---

## 5. Полный список API эндпоинтов

### История болезни
```
GET    /api/v1/patients/:id/history
GET    /api/v1/patients/:id/history/:entryId
POST   /api/v1/patients/:id/history
PATCH  /api/v1/patients/:id/history/:entryId
DELETE /api/v1/patients/:id/history/:entryId
POST   /api/v1/patients/:id/history/:entryId/verify
GET    /api/v1/patients/:id/history/stats
```

### ИИ анализ документов
```
POST   /api/v1/ai/analyze-medical-document
POST   /api/v1/ai/transcribe-audio
```

### История палат
```
GET    /api/v1/patients/:id/rooms/current
GET    /api/v1/patients/:id/rooms/history
POST   /api/v1/patients/:id/rooms/transfer
GET    /api/v1/rooms/:roomId/map
GET    /api/v1/departments/:deptId/rooms/availability
```
