"""Russian descriptions for API documentation.

Integration: import and pass to FastAPI app in main.py:

    from app.api.v1.api_docs import API_TAGS, API_DESCRIPTION

    app = FastAPI(
        ...,
        openapi_tags=API_TAGS,
        description=API_DESCRIPTION,
    )
"""

API_TAGS = [
    {"name": "Auth", "description": "Аутентификация — вход, выход, обновление токена"},
    {"name": "Patients", "description": "Управление пациентами — CRUD, поиск, регистрация"},
    {"name": "Staff", "description": "Управление персоналом — профили, роли, права"},
    {"name": "Schedule", "description": "Расписание приёмов и смен врачей"},
    {"name": "Appointments", "description": "Управление приёмами пациентов"},
    {"name": "Medical History", "description": "История болезни пациента"},
    {"name": "Treatment", "description": "Планы лечения и назначения"},
    {"name": "Laboratory", "description": "Лабораторные исследования и результаты"},
    {"name": "Pharmacy", "description": "Аптека — лекарства, рецепты, склад"},
    {"name": "Billing", "description": "Биллинг — счета, платежи, финансы"},
    {"name": "Monitoring", "description": "IoT мониторинг пациентов — датчики, алерты"},
    {"name": "Infrastructure", "description": "BMS — управление зданием, климат, безопасность"},
    {"name": "Telemedicine", "description": "Видеоконсультации через Daily.co"},
    {"name": "Portal", "description": "Портал пациента — личный кабинет"},
    {"name": "AI", "description": "AI функции — суммаризация, голосовой ассистент"},
    {"name": "QR", "description": "QR-коды и идентификация пациентов"},
    {"name": "Wristbands", "description": "Браслеты пациентов — выдача, сканирование"},
    {"name": "Queue", "description": "Очередь приёма — управление и лобби-дисплей"},
    {"name": "Chief Dashboard", "description": "KPI дашборд для руководителя"},
    {"name": "Predictions", "description": "Предиктивная аналитика — прогнозы"},
    {"name": "Export", "description": "Экспорт данных в Excel/PDF"},
    {"name": "Document Templates", "description": "Шаблоны медицинских документов"},
    {"name": "Notifications", "description": "Уведомления — SMS, WhatsApp, Telegram"},
    {"name": "RBAC", "description": "Управление ролями и правами доступа"},
    {"name": "Referrals", "description": "Направления между врачами"},
    {"name": "Surgery", "description": "Протоколы операций"},
    {"name": "Nurse Diary", "description": "Дневник наблюдений медсестры"},
    {"name": "Infection Control", "description": "Контроль инфекций и карантин"},
    {"name": "DICOM", "description": "Медицинские снимки — рентген, МРТ, КТ"},
    {"name": "E-Prescriptions", "description": "Электронные рецепты с QR-кодом"},
    {"name": "Duty Schedule", "description": "Расписание дежурств врачей"},
    {"name": "Insurance", "description": "Страховые компании и полисы"},
    {"name": "Consumables", "description": "Складской учёт расходных материалов"},
    {"name": "Equipment", "description": "Телеметрия медицинского оборудования"},
    {"name": "CRM", "description": "CRM — лиды и маркетинг"},
    {"name": "Promotions", "description": "Скидки и акции"},
    {"name": "Time Tracking", "description": "Учёт рабочего времени персонала"},
    {"name": "Corporate", "description": "Корпоративные договоры"},
    {"name": "Reports", "description": "Отчёты — врачи, отделения, финансы"},
    {"name": "Fiscal", "description": "Фискальные чеки (ККМ)"},
    {"name": "Loyalty", "description": "Бонусная программа пациентов"},
]

API_DESCRIPTION = """
# MedCore KG API

Телемедицинская SaaS-платформа для клиник Кыргызстана.

## Аутентификация

Все защищённые эндпоинты требуют JWT токен в заголовке:
```
Authorization: Bearer <access_token>
```

Получить токен: `POST /api/v1/auth/login`

## Версионирование

Текущая версия API: **v1**
Базовый URL: `/api/v1/`
"""
