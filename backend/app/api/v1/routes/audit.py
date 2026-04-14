from __future__ import annotations
import uuid
from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Log"])


@router.get("/logs")
async def list_audit_logs(
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
    action: str | None = None,
    resource_type: str | None = None,
    user_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    query = (
        select(AuditLog)
        .where(AuditLog.clinic_id == current_user.clinic_id)
        .order_by(desc(AuditLog.created_at))
    )
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    from sqlalchemy import func
    count_q = select(func.count()).select_from(AuditLog).where(AuditLog.clinic_id == current_user.clinic_id)
    if action:
        count_q = count_q.where(AuditLog.action == action)
    if resource_type:
        count_q = count_q.where(AuditLog.resource_type == resource_type)
    if user_id:
        count_q = count_q.where(AuditLog.user_id == user_id)
    total_result = await session.execute(count_q)
    total = total_result.scalar_one()

    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    logs = list(result.scalars().all())

    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_name": f"{log.user.last_name} {log.user.first_name}" if log.user else None,
                "user_role": log.user.role.value if log.user else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else None,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/logs/actions")
async def list_audit_actions(
    session: DBSession,
    current_user: CurrentUser,
    _admin=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN),
):
    """Get distinct action types for filter dropdown."""
    from sqlalchemy import func
    query = (
        select(AuditLog.action, func.count().label("count"))
        .where(AuditLog.clinic_id == current_user.clinic_id)
        .group_by(AuditLog.action)
        .order_by(desc(func.count()))
    )
    result = await session.execute(query)
    return [{"action": row.action, "count": row.count} for row in result.all()]
