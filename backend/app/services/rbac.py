import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ConflictError, ForbiddenError
from app.core.security import hash_password
from app.models.rbac import (
    PermissionGroup, PermissionItem, PermissionTemplate,
    TemplatePermission, TemplateExtraField, UserTemplate, UserPermissionOverride,
)
from app.models.staff_profile import StaffProfile
from app.models.user import User
import secrets
import string


def generate_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


class RBACService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- Effective permissions ---
    async def get_effective_permissions(self, user_id: uuid.UUID, clinic_id: uuid.UUID) -> set[str]:
        # 1. Template permissions
        result = await self.session.execute(
            select(PermissionItem.code)
            .join(TemplatePermission, PermissionItem.id == TemplatePermission.permission_id)
            .join(UserTemplate, TemplatePermission.template_id == UserTemplate.template_id)
            .where(UserTemplate.user_id == user_id)
        )
        perms = set(result.scalars().all())

        # 2. Overrides
        overrides = await self.session.execute(
            select(UserPermissionOverride.is_granted, PermissionItem.code)
            .join(PermissionItem, UserPermissionOverride.permission_id == PermissionItem.id)
            .where(
                UserPermissionOverride.user_id == user_id,
                UserPermissionOverride.clinic_id == clinic_id,
            )
        )
        for is_granted, code in overrides:
            if is_granted:
                perms.add(code)
            else:
                perms.discard(code)

        return perms

    # --- Permission groups & items ---
    async def get_permission_groups(self) -> list[dict]:
        result = await self.session.execute(
            select(PermissionGroup).order_by(PermissionGroup.sort_order)
        )
        groups = result.scalars().all()
        output = []
        for g in groups:
            perms_q = await self.session.execute(
                select(PermissionItem).where(PermissionItem.group_id == g.id).order_by(PermissionItem.sort_order)
            )
            perms = perms_q.scalars().all()
            output.append({
                "id": str(g.id), "code": g.code, "label_ru": g.label_ru, "icon": g.icon,
                "permissions": [
                    {"id": str(p.id), "code": p.code, "label_ru": p.label_ru, "description": p.description}
                    for p in perms
                ],
            })
        return output

    # --- Templates ---
    async def list_templates(self, clinic_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            select(PermissionTemplate).where(
                PermissionTemplate.is_deleted == False,
                ((PermissionTemplate.clinic_id == clinic_id) | (PermissionTemplate.is_system == True)),
            ).order_by(PermissionTemplate.name)
        )
        templates = result.scalars().all()
        output = []
        for t in templates:
            perm_count = await self.session.execute(
                select(func.count()).select_from(TemplatePermission).where(TemplatePermission.template_id == t.id)
            )
            staff_count = await self.session.execute(
                select(func.count()).select_from(UserTemplate).where(UserTemplate.template_id == t.id)
            )
            output.append({
                "id": str(t.id), "name": t.name, "description": t.description,
                "color": t.color, "icon_initials": t.icon_initials,
                "is_system": t.is_system,
                "permission_count": perm_count.scalar_one(),
                "staff_count": staff_count.scalar_one(),
            })
        return output

    async def get_template(self, template_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(PermissionTemplate).where(PermissionTemplate.id == template_id, PermissionTemplate.is_deleted == False)
        )
        t = result.scalar_one_or_none()
        if not t:
            raise NotFoundError("Template")

        perms_q = await self.session.execute(
            select(PermissionItem.code)
            .join(TemplatePermission, PermissionItem.id == TemplatePermission.permission_id)
            .where(TemplatePermission.template_id == template_id)
        )
        perm_codes = list(perms_q.scalars().all())

        fields_q = await self.session.execute(
            select(TemplateExtraField).where(TemplateExtraField.template_id == template_id).order_by(TemplateExtraField.sort_order)
        )
        fields = [
            {"id": str(f.id), "field_key": f.field_key, "label_ru": f.label_ru, "field_type": f.field_type, "options": f.options, "is_required": f.is_required, "sort_order": f.sort_order}
            for f in fields_q.scalars().all()
        ]

        return {
            "id": str(t.id), "name": t.name, "description": t.description,
            "color": t.color, "icon_initials": t.icon_initials, "is_system": t.is_system,
            "permissions": perm_codes, "extra_fields": fields,
        }

    async def create_template(self, data: dict, clinic_id: uuid.UUID, created_by: uuid.UUID) -> dict:
        tpl = PermissionTemplate(
            id=uuid.uuid4(), clinic_id=clinic_id, name=data["name"],
            description=data.get("description"), color=data.get("color"),
            icon_initials=data.get("icon_initials"), created_by=created_by,
        )
        self.session.add(tpl)
        await self.session.flush()

        for perm_code in data.get("permissions", []):
            perm_q = await self.session.execute(select(PermissionItem.id).where(PermissionItem.code == perm_code))
            perm_id = perm_q.scalar_one_or_none()
            if perm_id:
                self.session.add(TemplatePermission(template_id=tpl.id, permission_id=perm_id))

        for field_data in data.get("extra_fields", []):
            self.session.add(TemplateExtraField(
                id=uuid.uuid4(), template_id=tpl.id, clinic_id=clinic_id, **field_data,
            ))

        await self.session.flush()
        return {"id": str(tpl.id), "name": tpl.name}

    async def update_template(self, template_id: uuid.UUID, data: dict) -> dict:
        result = await self.session.execute(
            select(PermissionTemplate).where(PermissionTemplate.id == template_id)
        )
        tpl = result.scalar_one_or_none()
        if not tpl:
            raise NotFoundError("Template")

        for field in ["name", "description", "color", "icon_initials"]:
            if field in data and data[field] is not None:
                setattr(tpl, field, data[field])

        if "permissions" in data:
            await self.session.execute(
                delete(TemplatePermission).where(TemplatePermission.template_id == template_id)
            )
            for perm_code in data["permissions"]:
                perm_q = await self.session.execute(select(PermissionItem.id).where(PermissionItem.code == perm_code))
                perm_id = perm_q.scalar_one_or_none()
                if perm_id:
                    self.session.add(TemplatePermission(template_id=template_id, permission_id=perm_id))

        await self.session.flush()
        return {"id": str(tpl.id), "name": tpl.name}

    async def delete_template(self, template_id: uuid.UUID) -> None:
        staff_count = await self.session.execute(
            select(func.count()).select_from(UserTemplate).where(UserTemplate.template_id == template_id)
        )
        if staff_count.scalar_one() > 0:
            raise ConflictError("Cannot delete template with active staff")

        result = await self.session.execute(select(PermissionTemplate).where(PermissionTemplate.id == template_id))
        tpl = result.scalar_one_or_none()
        if tpl:
            tpl.is_deleted = True
            await self.session.flush()

    async def duplicate_template(self, template_id: uuid.UUID, clinic_id: uuid.UUID, created_by: uuid.UUID) -> dict:
        source = await self.get_template(template_id)
        new_data = {
            "name": f"{source['name']} (копия)",
            "description": source.get("description"),
            "color": source.get("color"),
            "icon_initials": source.get("icon_initials"),
            "permissions": source.get("permissions", []),
            "extra_fields": source.get("extra_fields", []),
        }
        return await self.create_template(new_data, clinic_id, created_by)

    # --- Staff ---
    async def create_staff(self, data: dict, actor_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        # Convert string dates to date objects
        from datetime import date as date_type
        for date_field in ["date_of_birth", "employment_start", "employment_end"]:
            val = data.get(date_field)
            if isinstance(val, str) and val:
                data[date_field] = date_type.fromisoformat(val)

        # Convert string UUIDs
        for uuid_field in ["department_id", "template_id"]:
            val = data.get(uuid_field)
            if isinstance(val, str) and val:
                data[uuid_field] = uuid.UUID(val)

        # Check login unique
        existing = await self.session.execute(
            select(User).where(User.email == data["login"], User.is_deleted == False)
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Логин уже занят")

        temp_pwd = generate_password()

        # Create user
        user = User(
            id=uuid.uuid4(), email=data["login"],
            hashed_password=hash_password(temp_pwd),
            first_name=data["first_name"], last_name=data["last_name"],
            middle_name=data.get("middle_name"),
            role="DOCTOR",  # legacy field — actual perms from template
            is_active=True, clinic_id=clinic_id,
        )
        self.session.add(user)
        await self.session.flush()

        # Create staff profile
        profile = StaffProfile(
            id=uuid.uuid4(), user_id=user.id, clinic_id=clinic_id,
            last_name=data["last_name"], first_name=data["first_name"],
            middle_name=data.get("middle_name"),
            date_of_birth=data["date_of_birth"], gender=data["gender"],
            phone_personal=data.get("phone_personal"),
            email_personal=data.get("email_personal"),
            photo_url=data.get("photo_url"),
            position=data["position"],
            position_level=data.get("position_level"),
            specialization=data.get("specialization"),
            department_id=data.get("department_id"),
            section=data.get("section"),
            employment_start=data["employment_start"],
            employment_end=data.get("employment_end"),
            employment_type=data["employment_type"],
            work_phone=data.get("work_phone"),
            work_email=data.get("work_email"),
            office_room=data.get("office_room"),
            max_patients=data.get("max_patients"),
            work_schedule=data.get("work_schedule"),
            qualifications=data.get("qualifications", []),
            extra_fields=data.get("extra_fields", {}),
        )
        self.session.add(profile)

        # Assign template
        tpl_id = data["template_id"] if isinstance(data["template_id"], uuid.UUID) else uuid.UUID(data["template_id"])
        self.session.add(UserTemplate(
            id=uuid.uuid4(), user_id=user.id,
            template_id=tpl_id,
            assigned_by=actor_id,
        ))

        # Permission overrides
        for override in data.get("permission_overrides", []):
            perm_q = await self.session.execute(
                select(PermissionItem.id).where(PermissionItem.code == override.get("permission_code", ""))
            )
            perm_id = perm_q.scalar_one_or_none()
            if perm_id:
                self.session.add(UserPermissionOverride(
                    id=uuid.uuid4(), user_id=user.id, permission_id=perm_id,
                    clinic_id=clinic_id, is_granted=override["is_granted"],
                    reason=override.get("reason"), created_by=actor_id,
                ))

        await self.session.flush()

        # Send credentials via email
        delivery = data.get("delivery_method", "email")
        email_sent = False
        recipient_email = data.get("work_email") or data.get("email_personal") or data.get("login", "")

        if delivery in ("email", "screen") and "@" in recipient_email:
            from app.core.email import send_staff_credentials
            staff_name = f"{data['last_name']} {data['first_name']}"
            email_sent = await send_staff_credentials(
                to_email=recipient_email,
                staff_name=staff_name,
                login=data["login"],
                password=temp_pwd,
                position=data.get("position", ""),
            )

        return {
            "staff_id": str(profile.id), "user_id": str(user.id),
            "login": data["login"], "temp_password": temp_pwd,
            "delivery_method": delivery,
            "email_sent": email_sent,
            "email_to": recipient_email if email_sent else None,
        }

    async def list_staff(self, clinic_id: uuid.UUID, skip: int = 0, limit: int = 20,
                         search: str | None = None, template_id: str | None = None,
                         department_id: str | None = None) -> tuple[list, int]:
        query = select(StaffProfile).where(StaffProfile.clinic_id == clinic_id, StaffProfile.is_deleted == False)
        count_query = select(func.count()).select_from(StaffProfile).where(StaffProfile.clinic_id == clinic_id, StaffProfile.is_deleted == False)

        if search:
            from sqlalchemy import or_
            sf = or_(
                StaffProfile.last_name.ilike(f"%{search}%"),
                StaffProfile.first_name.ilike(f"%{search}%"),
                StaffProfile.position.ilike(f"%{search}%"),
            )
            query = query.where(sf)
            count_query = count_query.where(sf)

        if department_id:
            query = query.where(StaffProfile.department_id == uuid.UUID(department_id))
            count_query = count_query.where(StaffProfile.department_id == uuid.UUID(department_id))

        total = (await self.session.execute(count_query)).scalar_one()
        result = await self.session.execute(query.order_by(StaffProfile.last_name).offset(skip).limit(limit))
        staff = result.scalars().all()

        items = []
        for s in staff:
            # Get template name
            tpl_q = await self.session.execute(
                select(PermissionTemplate.name, PermissionTemplate.color)
                .join(UserTemplate, PermissionTemplate.id == UserTemplate.template_id)
                .where(UserTemplate.user_id == s.user_id)
            )
            tpl_row = tpl_q.first()
            items.append({
                "id": str(s.id), "user_id": str(s.user_id),
                "last_name": s.last_name, "first_name": s.first_name, "middle_name": s.middle_name,
                "position": s.position, "position_level": s.position_level,
                "photo_url": s.photo_url,
                "template_name": tpl_row[0] if tpl_row else None,
                "template_color": tpl_row[1] if tpl_row else None,
                "department_id": str(s.department_id) if s.department_id else None,
                "employment_type": s.employment_type,
                "is_active": True,
            })

        return items, total

    async def get_staff(self, staff_id: uuid.UUID, clinic_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(StaffProfile).where(StaffProfile.id == staff_id, StaffProfile.clinic_id == clinic_id, StaffProfile.is_deleted == False)
        )
        s = result.scalar_one_or_none()
        if not s:
            raise NotFoundError("Staff")

        tpl_q = await self.session.execute(
            select(PermissionTemplate.name, PermissionTemplate.color, PermissionTemplate.id)
            .join(UserTemplate, PermissionTemplate.id == UserTemplate.template_id)
            .where(UserTemplate.user_id == s.user_id)
        )
        tpl_row = tpl_q.first()

        perms = await self.get_effective_permissions(s.user_id, clinic_id)

        return {
            "id": str(s.id), "user_id": str(s.user_id),
            "last_name": s.last_name, "first_name": s.first_name, "middle_name": s.middle_name,
            "date_of_birth": s.date_of_birth, "gender": s.gender,
            "phone_personal": s.phone_personal, "email_personal": s.email_personal,
            "photo_url": s.photo_url,
            "position": s.position, "position_level": s.position_level,
            "specialization": s.specialization,
            "department_id": str(s.department_id) if s.department_id else None,
            "section": s.section,
            "employment_start": s.employment_start, "employment_end": s.employment_end,
            "employment_type": s.employment_type,
            "work_phone": s.work_phone, "work_email": s.work_email,
            "office_room": s.office_room, "max_patients": s.max_patients,
            "work_schedule": s.work_schedule,
            "qualifications": s.qualifications or [],
            "extra_fields": s.extra_fields or {},
            "template": {"id": str(tpl_row[2]), "name": tpl_row[0], "color": tpl_row[1]} if tpl_row else None,
            "effective_permissions": sorted(list(perms)),
        }

    async def deactivate_staff(self, staff_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        result = await self.session.execute(
            select(StaffProfile).where(StaffProfile.id == staff_id, StaffProfile.clinic_id == clinic_id)
        )
        s = result.scalar_one_or_none()
        if not s:
            raise NotFoundError("Staff")
        user_q = await self.session.execute(select(User).where(User.id == s.user_id))
        user = user_q.scalar_one_or_none()
        if user:
            user.is_active = False
        await self.session.flush()
