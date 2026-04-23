---
aliases: [HL7, FHIR, Lab Analyzer, Лабораторный анализатор, Интеграция анализаторов]
tags: [feature, hl7, fhir, laboratory, integration]
created: 2026-04-23
---

# HL7/FHIR интеграция (Lab Analyzers)

> Интеграция с лабораторными анализаторами по стандартам HL7 v2.5 и FHIR R4. Приём результатов анализов напрямую от оборудования, конвертация в FHIR-ресурсы, выдача данных пациента в формате FHIR.

---

## Обзор

Поддерживаемые протоколы:
- **HL7 v2.5** — приём ORU (Observation Result) сообщений, автоматический ACK
- **FHIR R4** — приём Observation, выдача Patient

Потоки данных:
1. Анализатор отправляет HL7 ORU → парсинг → сохранение в `lab_results` → ACK
2. LIMS отправляет FHIR Observation → конвертация → сохранение
3. Внешняя система запрашивает FHIR Patient → конвертация из внутренней модели

---

## Архитектура

### Сервис

**Файл:** `backend/app/services/hl7_service.py`

| Класс | Метод | Описание |
|-------|-------|----------|
| `HL7Message` | `parse_oru()` | Парсинг HL7 ORU сообщения (PID, OBX сегменты) |
| `HL7Message` | `create_ack()` | Создание HL7 ACK ответа |
| `FHIRConverter` | `observation_to_lab_result()` | FHIR Observation → внутренний формат |
| `FHIRConverter` | `patient_to_fhir()` | Внутренний пациент → FHIR Patient |

### Бэкенд

- **Сервис:** `backend/app/services/hl7_service.py`
- **Маршруты:** `backend/app/api/v1/routes/hl7_fhir.py`

---

## API Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/integrations/hl7/receive` | Приём HL7 сообщения (raw text) |
| GET | `/api/v1/integrations/hl7/status` | Статус подключения |
| POST | `/api/v1/integrations/fhir/Observation` | Приём FHIR Observation |
| GET | `/api/v1/integrations/fhir/Patient/{id}` | Пациент в формате FHIR |

---

## Бизнес-логика

1. HL7 ORU парсится по сегментам: MSH (заголовок), PID (пациент), OBX (результат)
2. Если пациент найден по ID — результаты сохраняются в `lab_results`
3. Всегда возвращается ACK с ID исходного сообщения
4. FHIR Observation привязывается к пациенту через `subject.reference` (формат `Patient/<uuid>`)
5. FHIR Patient выдаётся со стандартными полями: name, birthDate, gender, telecom

---

## Связанные модули

- [[Лаборатория]] — Анализы и результаты
- [[Очередь на анализы]] — Электронная очередь
