---
aliases: [E-Prescription, Электронный рецепт, QR рецепт]
tags: [feature, prescription, qr, pharmacy]
created: 2026-04-23
---

# Электронный рецепт (E-Prescription)

Электронные рецепты с уникальным кодом RX-XXXXXXXX и QR-кодом для сканирования в аптеке.

## Возможности

- Создание рецепта с автогенерацией кода RX-XXXXXXXX
- Привязка к пациенту, врачу, диагнозу (МКБ-10)
- Список препаратов с дозировкой, частотой, длительностью
- QR-код для сканирования в аптеке (PNG / SVG)
- Печатный HTML-бланк рецепта с QR
- Поиск рецепта по коду (для фармацевта)
- Отметка о выдаче (dispense) с ID фармацевта
- Отмена рецепта
- Срочные рецепты (is_urgent)
- Повторные выдачи (refill_count / max_refills)
- Срок действия (valid_until)

## Статусы

| Статус | Описание |
|--------|----------|
| `active` | Активный |
| `dispensed` | Выдан |
| `expired` | Истёк |
| `cancelled` | Отменён |

## Формат medications (JSON)

```json
[
  {
    "name": "Аспирин",
    "dosage": "100мг",
    "frequency": "1 раз/день",
    "duration": "30 дней",
    "quantity": 30
  }
]
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/e-prescriptions/` | Создать рецепт |
| GET | `/api/v1/e-prescriptions/` | Список (фильтры: patient_id, doctor_id, status) |
| GET | `/api/v1/e-prescriptions/{id}` | Детали |
| GET | `/api/v1/e-prescriptions/code/{code}` | Поиск по коду (сканирование) |
| POST | `/api/v1/e-prescriptions/{id}/dispense` | Отметить выдачу |
| GET | `/api/v1/e-prescriptions/{id}/qr` | QR-код (PNG/SVG) |
| GET | `/api/v1/e-prescriptions/{id}/print` | Печатный HTML с QR |
| POST | `/api/v1/e-prescriptions/{id}/cancel` | Отменить |

## Файлы

| Компонент | Путь |
|-----------|------|
| Модель | `backend/app/models/e_prescription.py` |
| Сервис | `backend/app/services/e_prescription_service.py` |
| Маршрут | `backend/app/api/v1/routes/e_prescriptions.py` |
