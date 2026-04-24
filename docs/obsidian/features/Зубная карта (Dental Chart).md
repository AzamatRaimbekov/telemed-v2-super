---
aliases: [Зубная карта, Dental Chart, Зубная формула]
tags: [dental, feature]
created: 2026-04-23
---

# Зубная карта (Dental Chart)

> Интерактивная зубная формула пациента с историей лечения каждого зуба. Нумерация по FDI (11-48, 32 зуба).

---

## Архитектура

### Backend
- **Модели:** `backend/app/models/dental_chart.py`
  - `DentalChart` — карта зубов пациента (JSON с 32 зубами)
  - `ToothTreatment` — запись лечения конкретного зуба
  - `ToothStatus` — enum статусов (healthy, caries, filled, crown, implant, missing, root_canal, bridge, veneer, temporary, planned)
- **Маршруты:** `backend/app/api/v1/routes/dental.py`
  - `GET /dental/chart/{patient_id}` — получить карту (авто-создание если нет)
  - `PUT /dental/chart/{patient_id}` — обновить карту
  - `POST /dental/chart/{patient_id}/tooth/{tooth_number}/treatment` — добавить лечение
  - `GET /dental/chart/{patient_id}/tooth/{tooth_number}/history` — история зуба
  - `GET /dental/treatments/{patient_id}` — все лечения пациента
  - `GET /dental/procedures` — каталог процедур

### Frontend
- **API:** `frontend/src/features/dental/api.ts`
  - Хуки: `useDentalChart`, `useUpdateChart`, `useAddTreatment`, `useToothHistory`, `usePatientTreatments`, `useDentalProcedures`
- **Страница:** `frontend/src/routes/_authenticated/dental-chart.tsx`
  - Интерактивная диаграмма 32 зубов (верхняя/нижняя челюсть)
  - Цветовая кодировка по статусу
  - Боковая панель: детали зуба, форма лечения, история

## Нумерация FDI

| Квадрант | Зубы |
|----------|------|
| Верхний правый | 18-11 |
| Верхний левый | 21-28 |
| Нижний левый | 31-38 |
| Нижний правый | 41-48 |

## Цветовая кодировка

| Статус | Цвет | Описание |
|--------|------|----------|
| healthy | Белый | Здоровый |
| caries | Красный | Кариес |
| filled | Синий | Пломба |
| crown | Золотой | Коронка |
| implant | Фиолетовый | Имплант |
| missing | Серый | Отсутствует |
| root_canal | Оранжевый | Лечение канала |

## Связи
- [[Каталог стоматологических процедур]]
- [[Стоматологические снимки]]
- [[Ортодонтическое лечение]]
