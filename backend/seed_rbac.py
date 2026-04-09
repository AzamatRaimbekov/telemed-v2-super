import asyncio
import uuid
from app.core.database import async_session_factory
from app.models.rbac import PermissionGroup, PermissionItem, PermissionTemplate, TemplatePermission, TemplateExtraField
from app.models.clinic import Clinic
from sqlalchemy import select

GROUPS = [
    {"code": "patients", "label_ru": "Пациенты", "icon": "users", "sort_order": 1},
    {"code": "medical_card", "label_ru": "Мед. карта", "icon": "file-text", "sort_order": 2},
    {"code": "treatment", "label_ru": "Лечение", "icon": "heart-pulse", "sort_order": 3},
    {"code": "pharmacy", "label_ru": "Аптека", "icon": "pill", "sort_order": 4},
    {"code": "laboratory", "label_ru": "Лаборатория", "icon": "flask", "sort_order": 5},
    {"code": "schedule", "label_ru": "Расписание", "icon": "calendar", "sort_order": 6},
    {"code": "billing", "label_ru": "Биллинг", "icon": "credit-card", "sort_order": 7},
    {"code": "staff", "label_ru": "Персонал", "icon": "user-cog", "sort_order": 8},
    {"code": "reports", "label_ru": "Отчёты", "icon": "bar-chart", "sort_order": 9},
]

PERMISSIONS = {
    "patients": [
        ("patients:create", "Создание пациентов"),
        ("patients:read_own", "Чтение своих пациентов"),
        ("patients:read_all", "Чтение всех пациентов"),
        ("patients:update", "Редактирование данных пациента"),
        ("patients:delete", "Удаление пациента"),
        ("patients:assign_staff", "Назначение персонала пациенту"),
    ],
    "medical_card": [
        ("medical_card:read_own", "Чтение карты своих пациентов"),
        ("medical_card:read_all", "Чтение всех карт"),
        ("medical_card:write_notes", "Запись в карту"),
        ("medical_card:vitals_record", "Запись показателей"),
        ("medical_card:vitals_read", "Чтение показателей"),
    ],
    "treatment": [
        ("treatment:create_plan", "Создание плана лечения"),
        ("treatment:edit_plan", "Редактирование плана"),
        ("treatment:view_plans", "Просмотр планов"),
        ("treatment:prescribe", "Назначение лекарств"),
        ("treatment:order_procedure", "Назначение процедур"),
        ("treatment:order_lab", "Назначение анализов"),
    ],
    "pharmacy": [
        ("pharmacy:view_stock", "Просмотр склада"),
        ("pharmacy:dispense", "Выдача лекарств"),
        ("pharmacy:manage_stock", "Управление складом"),
        ("pharmacy:purchase_orders", "Заказы поставщикам"),
    ],
    "laboratory": [
        ("lab:view_orders", "Просмотр заказов"),
        ("lab:collect_sample", "Сбор образцов"),
        ("lab:enter_results", "Ввод результатов"),
        ("lab:approve_results", "Одобрение результатов"),
        ("lab:release_to_patient", "Открыть результат пациенту"),
    ],
    "schedule": [
        ("schedule:view_own", "Своё расписание"),
        ("schedule:view_all", "Всё расписание"),
        ("schedule:manage_appointments", "Управление записями"),
        ("schedule:manage_shifts", "Управление сменами"),
    ],
    "billing": [
        ("billing:view_invoices", "Просмотр счетов"),
        ("billing:create_invoice", "Создание счетов"),
        ("billing:process_payment", "Приём оплаты"),
        ("billing:manage_insurance", "Управление страховками"),
        ("billing:view_reports", "Финансовые отчёты"),
    ],
    "staff": [
        ("staff:view", "Просмотр сотрудников"),
        ("staff:create", "Создание сотрудников"),
        ("staff:edit", "Редактирование сотрудников"),
        ("staff:deactivate", "Деактивация"),
        ("staff:manage_permissions", "Управление правами"),
        ("staff:manage_templates", "Управление шаблонами"),
    ],
    "reports": [
        ("reports:view_clinical", "Клинические отчёты"),
        ("reports:view_financial", "Финансовые отчёты"),
        ("reports:view_operational", "Операционные отчёты"),
        ("reports:export", "Экспорт отчётов"),
    ],
}

# Template name → list of permission codes
TEMPLATE_PERMS = {
    "Врач": [
        "patients:create", "patients:read_own", "patients:update", "patients:assign_staff",
        "medical_card:read_own", "medical_card:write_notes", "medical_card:vitals_read",
        "treatment:create_plan", "treatment:edit_plan", "treatment:view_plans", "treatment:prescribe", "treatment:order_procedure", "treatment:order_lab",
        "lab:approve_results", "lab:release_to_patient",
        "schedule:view_own", "schedule:manage_appointments",
        "billing:view_invoices",
        "reports:view_clinical",
    ],
    "Медсестра": [
        "patients:read_own", "patients:update",
        "medical_card:read_own", "medical_card:vitals_record", "medical_card:vitals_read",
        "treatment:view_plans",
        "lab:collect_sample",
        "schedule:view_own",
    ],
    "Ресепшн": [
        "patients:create", "patients:read_all", "patients:update", "patients:assign_staff",
        "schedule:view_all", "schedule:manage_appointments",
        "billing:view_invoices", "billing:create_invoice", "billing:process_payment",
    ],
    "Фармацевт": [
        "patients:read_all",
        "pharmacy:view_stock", "pharmacy:dispense", "pharmacy:manage_stock", "pharmacy:purchase_orders",
    ],
    "Лаборант": [
        "patients:read_all",
        "lab:view_orders", "lab:collect_sample", "lab:enter_results",
    ],
    "Физиотерапевт": [
        "patients:read_own", "patients:update",
        "medical_card:read_own", "medical_card:vitals_record", "medical_card:vitals_read",
        "treatment:view_plans", "treatment:order_procedure",
        "schedule:view_own",
    ],
    "Клиник Админ": list({code for codes in PERMISSIONS.values() for code, _ in codes}),
}

TEMPLATES_META = {
    "Врач": {"color": "#10B981", "icon_initials": "ДР", "desc": "Полный доступ к пациентам и лечению"},
    "Медсестра": {"color": "#EC4899", "icon_initials": "МС", "desc": "Уход за пациентами, показатели"},
    "Ресепшн": {"color": "#F59E0B", "icon_initials": "РЦ", "desc": "Регистрация и расписание"},
    "Фармацевт": {"color": "#8B5CF6", "icon_initials": "ФМ", "desc": "Управление аптекой"},
    "Лаборант": {"color": "#3B82F6", "icon_initials": "ЛБ", "desc": "Лабораторные исследования"},
    "Физиотерапевт": {"color": "#14B8A6", "icon_initials": "ФТ", "desc": "Реабилитация и физиотерапия"},
    "Клиник Админ": {"color": "#7E78D2", "icon_initials": "АД", "desc": "Полный доступ ко всему"},
}

TEMPLATE_EXTRA_FIELDS = {
    "Врач": [
        {"field_key": "medical_category", "label_ru": "Медицинская категория", "field_type": "select", "options": ["Нет", "Первая", "Высшая", "Заслуженный врач"], "sort_order": 1},
        {"field_key": "academic_degree", "label_ru": "Учёная степень", "field_type": "select", "options": ["Нет", "PhD", "Кандидат мед. наук", "Доктор мед. наук"], "sort_order": 2},
        {"field_key": "max_patients", "label_ru": "Макс. пациентов", "field_type": "number", "is_required": True, "sort_order": 3},
    ],
    "Медсестра": [
        {"field_key": "nursing_grade", "label_ru": "Разряд медсестры", "field_type": "select", "options": ["1", "2", "3", "Высший"], "sort_order": 1},
        {"field_key": "procedures", "label_ru": "Разрешённые процедуры", "field_type": "multiselect", "options": ["Капельницы", "Уколы", "Перевязки", "Катетеры", "Забор крови"], "sort_order": 2},
    ],
    "Физиотерапевт": [
        {"field_key": "therapy_methods", "label_ru": "Методики", "field_type": "multiselect", "options": ["ЛФК", "Массаж", "Электрофорез", "Ультразвук", "Магнитотерапия"], "sort_order": 1},
        {"field_key": "stroke_certified", "label_ru": "Сертификат реабилитации инсультников", "field_type": "boolean", "sort_order": 2},
    ],
}


async def seed_rbac():
    async with async_session_factory() as session:
        # Get clinic
        result = await session.execute(select(Clinic).limit(1))
        clinic = result.scalar_one_or_none()
        if not clinic:
            print("No clinic found. Run seed.py first.")
            return

        # Check if already seeded
        existing = await session.execute(select(PermissionGroup).limit(1))
        if existing.scalar_one_or_none():
            print("RBAC already seeded.")
            return

        clinic_id = clinic.id

        # 1. Permission groups
        group_map = {}
        for g in GROUPS:
            group = PermissionGroup(id=uuid.uuid4(), **g)
            session.add(group)
            group_map[g["code"]] = group.id

        # 2. Permissions
        perm_map = {}  # code → id
        for group_code, perms in PERMISSIONS.items():
            for i, (code, label) in enumerate(perms):
                perm_id = uuid.uuid4()
                session.add(PermissionItem(
                    id=perm_id, group_id=group_map[group_code],
                    code=code, label_ru=label, is_system=True, sort_order=i,
                ))
                perm_map[code] = perm_id

        await session.flush()

        # 3. Templates + their permissions + extra fields
        for tpl_name, perm_codes in TEMPLATE_PERMS.items():
            meta = TEMPLATES_META[tpl_name]
            tpl = PermissionTemplate(
                id=uuid.uuid4(), clinic_id=clinic_id, name=tpl_name,
                description=meta["desc"], color=meta["color"],
                icon_initials=meta["icon_initials"], is_system=True,
            )
            session.add(tpl)
            await session.flush()

            # Template permissions
            for code in perm_codes:
                if code in perm_map:
                    session.add(TemplatePermission(template_id=tpl.id, permission_id=perm_map[code]))

            # Extra fields
            if tpl_name in TEMPLATE_EXTRA_FIELDS:
                for field_data in TEMPLATE_EXTRA_FIELDS[tpl_name]:
                    session.add(TemplateExtraField(
                        id=uuid.uuid4(), template_id=tpl.id,
                        clinic_id=clinic_id, **field_data,
                    ))

        await session.commit()
        print(f"RBAC seeded: {len(GROUPS)} groups, {len(perm_map)} permissions, {len(TEMPLATE_PERMS)} templates")


if __name__ == "__main__":
    asyncio.run(seed_rbac())
