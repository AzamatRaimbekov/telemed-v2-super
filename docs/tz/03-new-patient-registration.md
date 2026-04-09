# ТЗ — Создание нового пациента (New Patient Registration)

Статус: В РАБОТЕ

## Точки входа
- Кнопка "Новый пациент" в хедере
- Кнопка в списке /patients
- Быстрый доступ с дашборда

## Структура страницы
Два столбца: левый 70% форма, правый 30% AI-камера
Прогресс-индикатор: 6 кругов по секциям

## OCR паспорта
- POST /api/v1/ocr/passport (multipart)
- OpenCV preprocessing + Tesseract rus+kir
- Поля с confidence > 0.85 зелёные, 0.6-0.85 жёлтые, < 0.6 красные

## AI-камера
- WebSocket ws://api/v1/camera/stream каждые 2 сек
- DeepFace detect → Redis TTL 15 мин
- Сетка 4×5 лиц, клик для привязки

## 6 секций формы
1. Личные данные (ФИО, ДР, пол, паспорт, ИНН с валидацией 14 цифр, адрес)
2. Контакты (телефон +996, email, экстренный контакт)
3. Медицинская информация (группа крови, аллергии с типом, хронические, инвалидность)
4. Страховка (ФОМС серия/номер, ДМС)
5. Назначение персонала (врач с нагрузкой, медсестра, консультант)
6. Госпитализация (тип, форма, отделение→палата→койка каскад, МКБ-10)

## Проверка дубликатов
- POST /api/v1/patients/validate (ИНН + паспорт)
- Паспорт дубликат: предупреждение (не блокирует)
- ИНН дубликат: блокирует сохранение

## Экстренная регистрация
- Минимальные поля: имя, ДР, врач, койка
- Статус requires_completion=true

## API эндпоинты (12)
- POST /api/v1/ocr/passport
- WS /api/v1/camera/stream
- GET /api/v1/camera/faces
- POST /api/v1/camera/manual-capture
- GET /api/v1/patients/validate
- GET /api/v1/doctors?clinic_id&with_load
- GET /api/v1/nurses?clinic_id
- GET /api/v1/departments?clinic_id
- GET /api/v1/rooms?department_id
- GET /api/v1/beds?room_id&status=available
- POST /api/v1/patients
- POST /api/v1/patients/emergency
