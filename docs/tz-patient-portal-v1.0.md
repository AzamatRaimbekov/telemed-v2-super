# ТЗ — Веб-портал пациента (Patient Portal)
## MedCore KG · Patient Portal · v1.0 · Апрель 2026

## 1. Общее описание
Веб-портал пациента — отдельная клиентская часть для пациентов и опекунов.
Прозрачный доступ к медицинской информации, финансам, плану лечения, расписанию.
Реабилитационные тренировки с MediaPipe Pose в браузере.

## 2. Функциональные модули

### 2.1 Главный дашборд
- Карточка пациента: ФИО, фото, возраст, мед. карта, группа крови, аллергии
- Виджет "Сегодня": ближайшая процедура, таймер обратного отсчёта
- Быстрые действия: врач, тренировка, расписание
- Уведомления: лекарства, анализы, сообщения врача
- Прогресс-бар восстановления
- Показатели здоровья: давление, пульс, сахар

### 2.2 План лечения
- Таймлайн от поступления до выписки
- Категории: лекарства, процедуры, анализы, терапии, тренировки
- Детальная карточка назначения
- Трекинг приёма лекарств (кнопка "Принял")
- Экспорт в PDF
- Статусы: scheduled, in_progress, completed, skipped, cancelled

### 2.3 История болезней
- Хронологический список визитов с фильтрами
- Карточка визита: дата, врач, диагноз МКБ-10, назначения
- Диагнозы: активные и архивные
- Результаты анализов с графиками динамики
- Медицинские документы
- Врач контролирует видимость

### 2.4 Финансовый отчёт
- Сводка: общая сумма, оплачено, задолженность, страховка
- Детализация по категориям
- Таблица транзакций
- Круговая диаграмма (Recharts)
- Линейный график расходов
- Экспорт PDF
- Валюта: KGS

### 2.5 Расписание и календарь
- Режимы: день, неделя, месяц
- Цветовая кодировка по типу события
- Карточка события по клику
- Уведомления за 30 мин, 1 час, 1 день
- Красная линия "сейчас"
- Синхронизация с планом лечения

### 2.6 Тренировки и реабилитация
- Каталог упражнений от врача
- MediaPipe Pose сессия через веб-камеру
- Real-time overlay скелета
- Подсчёт повторений, оценка качества
- Обратная связь: текстовые подсказки
- Результаты и графики прогресса

## 3. API эндпоинты

### Дашборд/профиль
- GET /api/v1/patient/me
- PUT /api/v1/patient/me
- GET /api/v1/patient/dashboard
- GET /api/v1/patient/notifications
- PATCH /api/v1/patient/notifications/{id}/read

### План лечения
- GET /api/v1/patient/treatment-plans
- GET /api/v1/patient/treatment-plans/{id}
- GET /api/v1/patient/prescriptions
- POST /api/v1/patient/prescriptions/{id}/confirm
- GET /api/v1/patient/treatment-plans/{id}/export-pdf

### История/анализы
- GET /api/v1/patient/visits
- GET /api/v1/patient/visits/{id}
- GET /api/v1/patient/diagnoses
- GET /api/v1/patient/lab-results
- GET /api/v1/patient/lab-results/{id}
- GET /api/v1/patient/documents

### Финансы
- GET /api/v1/patient/billing/summary
- GET /api/v1/patient/billing/transactions
- GET /api/v1/patient/billing/categories
- GET /api/v1/patient/billing/export-pdf

### Расписание
- GET /api/v1/patient/schedule?date=YYYY-MM-DD
- GET /api/v1/patient/schedule?from=...&to=...
- GET /api/v1/patient/schedule/upcoming

### Тренировки
- GET /api/v1/patient/exercises
- GET /api/v1/patient/exercises/{id}
- POST /api/v1/patient/exercises/sessions
- GET /api/v1/patient/exercises/sessions
- GET /api/v1/patient/exercises/progress

## 4. UI/UX
- Primary: #BDEDE0, Secondary: #7E78D2
- Mobile: bottom tab bar (5 tabs)
- Desktop: collapsible sidebar
- Skeleton loading, empty states, error boundaries
- WCAG 2.1 AA

## 5. Карта экранов
- / — Дашборд
- /treatment — Планы лечения
- /treatment/:id — Детали плана
- /history — История болезней
- /history/visits, /history/diagnoses, /history/lab-results, /history/documents
- /schedule — Календарь
- /billing — Финансы
- /exercises — Тренировки
- /exercises/:id, /exercises/session/:planId, /exercises/history, /exercises/progress
- /profile — Профиль
- /messages — Сообщения
