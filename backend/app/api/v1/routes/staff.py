from __future__ import annotations
import uuid
from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.services.rbac import RBACService

router = APIRouter(tags=["Staff & RBAC"])


# ── Staff ──────────────────────────────────────────────────────────────────────

@router.post("/staff", status_code=201)
async def create_staff(data: dict, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.create_staff(data, current_user.id, current_user.clinic_id)

@router.get("/staff")
async def list_staff(session: DBSession, current_user: CurrentUser, skip: int = Query(0), limit: int = Query(20), search: str | None = None, template_id: str | None = None, department_id: str | None = None):
    service = RBACService(session)
    items, total = await service.list_staff(current_user.clinic_id, skip, limit, search, template_id, department_id)
    return {"items": items, "total": total}

@router.get("/staff/{staff_id}")
async def get_staff(staff_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.get_staff(staff_id, current_user.clinic_id)

@router.patch("/staff/{staff_id}")
async def update_staff(staff_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from sqlalchemy import select
    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id, StaffProfile.clinic_id == current_user.clinic_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")
    for key, value in data.items():
        if hasattr(s, key) and value is not None:
            setattr(s, key, value)
    await session.flush()
    return {"status": "updated"}

@router.post("/staff/{staff_id}/deactivate")
async def deactivate_staff(staff_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    await service.deactivate_staff(staff_id, current_user.clinic_id)
    return {"status": "deactivated"}

@router.post("/staff/{staff_id}/reset-password")
async def reset_password(staff_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from app.models.user import User
    from app.core.security import hash_password
    from app.services.rbac import generate_password
    from app.core.email import send_password_reset
    from sqlalchemy import select

    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")

    user_q = await session.execute(select(User).where(User.id == s.user_id))
    user = user_q.scalar_one()

    new_pwd = generate_password()
    user.hashed_password = hash_password(new_pwd)
    await session.flush()

    # Send new password via email
    recipient_email = s.work_email or s.email_personal or user.email
    email_sent = False
    if recipient_email and "@" in recipient_email:
        staff_name = f"{s.last_name} {s.first_name}"
        email_sent = await send_password_reset(recipient_email, staff_name, new_pwd)

    return {
        "temp_password": new_pwd,
        "email_sent": email_sent,
        "email_to": recipient_email if email_sent else None,
    }

@router.get("/staff/{staff_id}/permissions")
async def get_staff_permissions(staff_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from sqlalchemy import select
    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")
    service = RBACService(session)
    perms = await service.get_effective_permissions(s.user_id, current_user.clinic_id)
    return {"permissions": sorted(list(perms))}

@router.post("/staff/{staff_id}/permissions/grant")
async def grant_permission(staff_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from app.models.rbac import PermissionItem, UserPermissionOverride
    from sqlalchemy import select
    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")
    perm_q = await session.execute(select(PermissionItem.id).where(PermissionItem.code == data["permission_code"]))
    perm_id = perm_q.scalar_one_or_none()
    if not perm_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Permission")
    session.add(UserPermissionOverride(
        id=uuid.uuid4(), user_id=s.user_id, permission_id=perm_id,
        clinic_id=current_user.clinic_id, is_granted=True,
        reason=data.get("reason"), created_by=current_user.id,
    ))
    await session.flush()
    return {"status": "granted"}

@router.post("/staff/{staff_id}/permissions/revoke")
async def revoke_permission(staff_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from app.models.rbac import PermissionItem, UserPermissionOverride
    from sqlalchemy import select
    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")
    perm_q = await session.execute(select(PermissionItem.id).where(PermissionItem.code == data["permission_code"]))
    perm_id = perm_q.scalar_one_or_none()
    if not perm_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Permission")
    session.add(UserPermissionOverride(
        id=uuid.uuid4(), user_id=s.user_id, permission_id=perm_id,
        clinic_id=current_user.clinic_id, is_granted=False,
        reason=data.get("reason"), created_by=current_user.id,
    ))
    await session.flush()
    return {"status": "revoked"}

@router.patch("/staff/{staff_id}/template")
async def change_template(staff_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    from app.models.staff_profile import StaffProfile
    from app.models.rbac import UserTemplate
    from sqlalchemy import select, delete as sql_delete
    result = await session.execute(select(StaffProfile).where(StaffProfile.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Staff")
    await session.execute(sql_delete(UserTemplate).where(UserTemplate.user_id == s.user_id))
    session.add(UserTemplate(
        id=uuid.uuid4(), user_id=s.user_id,
        template_id=uuid.UUID(data["template_id"]), assigned_by=current_user.id,
    ))
    await session.flush()
    return {"status": "template_changed"}


# ── Templates ──────────────────────────────────────────────────────────────────

@router.get("/permission-templates")
async def list_templates(session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.list_templates(current_user.clinic_id)

@router.post("/permission-templates", status_code=201)
async def create_template(data: dict, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.create_template(data, current_user.clinic_id, current_user.id)

@router.get("/permission-templates/{template_id}")
async def get_template(template_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.get_template(template_id)

@router.put("/permission-templates/{template_id}")
async def update_template(template_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.update_template(template_id, data)

@router.delete("/permission-templates/{template_id}", status_code=204)
async def delete_template(template_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    await service.delete_template(template_id)

@router.post("/permission-templates/{template_id}/duplicate", status_code=201)
async def duplicate_template(template_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.duplicate_template(template_id, current_user.clinic_id, current_user.id)

@router.get("/permission-templates/{template_id}/staff")
async def get_template_staff(template_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.rbac import UserTemplate
    from app.models.staff_profile import StaffProfile
    from sqlalchemy import select
    result = await session.execute(
        select(StaffProfile)
        .join(UserTemplate, StaffProfile.user_id == UserTemplate.user_id)
        .where(UserTemplate.template_id == template_id, StaffProfile.clinic_id == current_user.clinic_id)
    )
    staff = result.scalars().all()
    return [{"id": str(s.id), "last_name": s.last_name, "first_name": s.first_name, "position": s.position} for s in staff]

@router.get("/permission-templates/{template_id}/fields")
async def get_template_fields(template_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.rbac import TemplateExtraField
    from sqlalchemy import select
    result = await session.execute(
        select(TemplateExtraField).where(TemplateExtraField.template_id == template_id).order_by(TemplateExtraField.sort_order)
    )
    return [{"id": str(f.id), "field_key": f.field_key, "label_ru": f.label_ru, "field_type": f.field_type, "options": f.options, "is_required": f.is_required, "sort_order": f.sort_order} for f in result.scalars().all()]

@router.post("/permission-templates/{template_id}/fields", status_code=201)
async def add_template_field(template_id: uuid.UUID, data: dict, session: DBSession, current_user: CurrentUser):
    from app.models.rbac import TemplateExtraField
    field = TemplateExtraField(
        id=uuid.uuid4(), template_id=template_id, clinic_id=current_user.clinic_id,
        field_key=data["field_key"], label_ru=data["label_ru"],
        field_type=data["field_type"], options=data.get("options"),
        is_required=data.get("is_required", False), sort_order=data.get("sort_order", 0),
    )
    session.add(field)
    await session.flush()
    return {"id": str(field.id)}

@router.delete("/permission-templates/{template_id}/fields/{field_id}", status_code=204)
async def delete_template_field(template_id: uuid.UUID, field_id: uuid.UUID, session: DBSession, current_user: CurrentUser):
    from app.models.rbac import TemplateExtraField
    from sqlalchemy import select
    result = await session.execute(select(TemplateExtraField).where(TemplateExtraField.id == field_id, TemplateExtraField.template_id == template_id))
    f = result.scalar_one_or_none()
    if f:
        await session.delete(f)
        await session.flush()


# ── Permissions lookup ─────────────────────────────────────────────────────────

@router.get("/permissions")
async def list_permissions(session: DBSession, current_user: CurrentUser):
    service = RBACService(session)
    return await service.get_permission_groups()

@router.get("/permission-groups")
async def list_permission_groups(session: DBSession, current_user: CurrentUser):
    from app.models.rbac import PermissionGroup
    from sqlalchemy import select
    result = await session.execute(select(PermissionGroup).order_by(PermissionGroup.sort_order))
    return [{"id": str(g.id), "code": g.code, "label_ru": g.label_ru, "icon": g.icon} for g in result.scalars().all()]
