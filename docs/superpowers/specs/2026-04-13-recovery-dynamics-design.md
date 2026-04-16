# Динамика восстановления пациента — Спецификация

## Обзор

Функционал для врачей, отображающий динамику восстановления пациента в виде графиков на вкладке "Обзор". Система вычисляет общий индекс восстановления (0–100%) и суб-индексы по 6 доменам на основе данных витальных показателей, лабораторных анализов, шкал оценки, упражнений, плана лечения и реабилитационных целей.

## Архитектурный подход

**Расчёт на фронтенде.** Бэкенд отдаёт сырые данные через существующие API + 2 новых эндпоинта для целей врача и весов доменов. Фронтенд вычисляет индексы и рендерит графики через Recharts.

Обоснование: почти все API уже существуют, мгновенная реакция при смене периода/фильтров, проще итерировать формулы.

## Система индексов

### Три режима расчёта (комбинированные)

1. **Фиксированные веса** — дефолтные веса доменов, работает из коробки
2. **Адаптивное перераспределение** — если у пациента нет данных по домену, его вес автоматически распределяется на остальные
3. **Ручные цели врача** — врач может задать целевые значения метрик и переопределить веса доменов

### Дефолтные веса доменов

| Домен | Вес | Цвет |
|---|---|---|
| Витальные показатели | 0.25 | Blue (#3b82f6) |
| Лабораторные анализы | 0.25 | Amber (#f59e0b) |
| План лечения | 0.20 | Purple (#8b5cf6) |
| Шкалы оценки | 0.15 | Rose (#f43f5e) |
| Упражнения | 0.15 | Cyan (#06b6d4) |
| Реабилитация (цели) | доп. | Green (#4ade80) |

Реабилитация отображается как 6-й виджет, но не входит в основной индекс — показывает статусы целей (достигнуто/в процессе/не достигнуто).

При адаптивном перераспределении: `normalized_weight = weight / sum(available_weights)`.

## Формулы расчёта

### calcVitalsScore(vitals[], goals[])

Для каждого показателя за выбранный период:
- Берём последнее значение
- Сравниваем с целью врача или дефолтной нормой:
  - АД систолическое: 110–140 мм рт.ст.
  - АД диастолическое: 70–90 мм рт.ст.
  - Пульс: 60–100 уд/мин
  - SpO₂: ≥95%
  - Температура: 36.0–37.2°C
  - Глюкоза: 3.9–6.1 ммоль/л
  - ЧДД: 12–20 в мин
- Балл метрики = 100 если в норме, линейное снижение до 0 при отклонении на 2× от границы нормы
- Итого = среднее по всем доступным метрикам

### calcLabsScore(labResults[], goals[])

- Берём последний результат каждого теста с `numeric_value`
- Сравниваем с `reference_range` из LabTestCatalog или целью врача
- Балл = 100 если в норме, снижается пропорционально отклонению
- `is_abnormal` флаг как дополнительный сигнал
- Итого = среднее по всем тестам, аномальные имеют двойной вес в расчёте среднего

### calcScalesScore(assessments[])

Разные шкалы имеют разную полярность:

| Шкала | Направление | Диапазон | Хороший результат |
|---|---|---|---|
| NIHSS | ↓ лучше | 0–42 | 0 |
| MRS | ↓ лучше | 0–6 | 0–1 |
| Barthel | ↑ лучше | 0–100 | 100 |
| MMSE | ↑ лучше | 0–30 | ≥24 |
| Beck | ↓ лучше | 0–63 | 0–9 |
| Dysphagia | ↓ лучше | 0–max_score (из StrokeAssessment.max_score) | 0 |

Балл = нормализация текущего значения к лучшему возможному (0–100%). Если несколько оценок за период — тренд улучшения даёт бонус к баллу.

### calcExerciseScore(sessions[])

Три компонента:
- **Точность** (40%) — средний `accuracy_score` сессий за период
- **Регулярность** (30%) — (кол-во сессий / ожидаемое по плану) × 100%
- **Прогресс** (30%) — улучшение accuracy за текущий vs предыдущий период

### calcTreatmentScore(plans[])

- Берём активные планы пациента
- `completed_items / total_items × 100%`
- Штраф за просроченные items: items со статусом PENDING и прошедшим `scheduled_at` снижают балл

### calcOverallIndex(domainScores, weights)

```
available_domains = домены где score !== null (есть данные)
total_weight = Σ weights[domain] для available_domains
normalized_weights = { domain: weight / total_weight }
index = Σ (domain_score × normalized_weight)
```

Если врач задал `weight_override` через RecoveryDomainWeight — используется вместо дефолтного. Перенормировка всегда на сумму = 1.0.

## UI-дизайн

### Расположение

Встраивается на вкладку "Обзор" (`overview.tsx`) между PatientInfoCard и таблицей витальных показателей.

### Компоновка: Индекс сверху + сетка виджетов 2×3

**Верхний блок — RecoveryIndexCard:**
- Число 0–100% крупно, цветокодировано: зелёный (≥70), жёлтый (40–69), красный (<40)
- Тренд: стрелка ▲/▼ и дельта за период ("▲ +5% за неделю")
- Мини-спарклайн тренда индекса
- Кнопки периода: 7д | 30д | 3м | Всё | Произвольный (date picker)

**Сетка виджетов — DomainWidgetsGrid (2×3):**

Каждый DomainWidget в свёрнутом состоянии:
- Иконка + название домена (цветокодировано)
- Суб-индекс (0–100%)
- Мини-спарклайн или прогресс-бар
- Индикатор тренда ▲/▼

### Expand/Collapse

Клик по виджету — он расширяется на месте, остальные сдвигаются вниз. Показывает:
- Полноразмерный график (Recharts LineChart/AreaChart)
- Чекбоксы для выбора конкретных метрик (АД, пульс, SpO₂...)
- Референсные зоны — зелёная полоса нормы на фоне графика (ReferenceArea)
- Hover-tooltip: значение, дата, кто записал
- Пунктирная линия целевого значения врача (ReferenceLine)
- Кнопка "Настроить цели" → inline-форма GoalsEditor

Повторный клик — collapse обратно.

### Адаптивность

- Нет данных по домену → виджет приглушён с текстом "Нет данных"
- Менее 6 доменов с данными → виджеты растягиваются

### Временные периоды

Кнопки быстрого выбора: 7 дней / 30 дней / 3 месяца / Всё время. Плюс произвольный диапазон через date picker (от–до). Период глобальный — применяется ко всем виджетам и индексу одновременно.

## Бэкенд: новые сущности

### Модель RecoveryGoal

```
id: UUID (PK)
patient_id: UUID (FK patients)
domain: Enum (VITALS, LABS, SCALES, EXERCISES, TREATMENT)
metric_key: String — например "systolic_bp", "hemoglobin", "nihss"
target_value: Numeric(12,4)
set_by_id: UUID (FK users)
created_at: DateTime
updated_at: DateTime
```

### Модель RecoveryDomainWeight

```
id: UUID (PK)
patient_id: UUID (FK patients)
domain: Enum (VITALS, LABS, SCALES, EXERCISES, TREATMENT)
weight: Numeric(3,2) — 0.00–1.00
set_by_id: UUID (FK users)
created_at: DateTime
updated_at: DateTime
```

### API-эндпоинты

- `GET /api/v1/patients/{patient_id}/recovery-goals` — список целей пациента
- `PUT /api/v1/patients/{patient_id}/recovery-goals` — обновить цели (bulk upsert)
- `GET /api/v1/patients/{patient_id}/recovery-weights` — веса доменов
- `PUT /api/v1/patients/{patient_id}/recovery-weights` — обновить веса (bulk upsert)

## Фронтенд: файловая структура

```
frontend/src/features/recovery/
├── components/
│   ├── RecoveryDashboard.tsx       — контейнер всего дашборда
│   ├── RecoveryIndexCard.tsx       — верхняя карточка индекса
│   ├── DomainWidgetsGrid.tsx       — сетка 2×3
│   ├── DomainWidget.tsx            — виджет домена (collapsed/expanded)
│   ├── ExpandedVitalsChart.tsx     — развёрнутый график витальных
│   ├── ExpandedLabsChart.tsx       — развёрнутый график анализов
│   ├── ExpandedScalesChart.tsx     — развёрнутый график шкал
│   ├── ExpandedExercisesChart.tsx  — развёрнутый график упражнений
│   ├── ExpandedTreatmentChart.tsx  — развёрнутый график плана лечения
│   ├── ExpandedRehabChart.tsx      — развёрнутый график реабилитации
│   ├── PeriodSelector.tsx          — кнопки периода + date picker
│   └── GoalsEditor.tsx             — inline-форма целей врача
├── hooks/
│   └── useRecoveryData.ts          — хук загрузки всех данных
├── lib/
│   └── recovery-calculator.ts      — чистые функции расчёта индексов
├── api.ts                          — API-клиент для recovery endpoints
└── types.ts                        — типы TypeScript
```

### Бэкенд: файловая структура

```
backend/app/models/recovery.py        — RecoveryGoal, RecoveryDomainWeight
backend/app/schemas/recovery.py       — Pydantic schemas
backend/app/services/recovery.py      — CRUD для целей и весов
backend/app/api/v1/routes/recovery.py — эндпоинты
```

## Загрузка данных

Хук `useRecoveryData(patientId, period)` использует `useQueries` из TanStack Query для параллельной загрузки:
- vitals, lab results, stroke assessments, exercise sessions, treatment plans, recovery goals, recovery weights

Кэширование по `[domain, patientId, period]`. При смене периода — рефетч.

## Графики (Recharts)

Все графики используют:
- `LineChart` / `AreaChart` для трендов
- `ReferenceArea` для зон нормы (зелёный полупрозрачный фон)
- `ReferenceLine` для целей врача (пунктир)
- `Tooltip` с деталями (значение, дата, кто записал)
- Responsive контейнер `ResponsiveContainer`
- Анимация через framer-motion для expand/collapse
