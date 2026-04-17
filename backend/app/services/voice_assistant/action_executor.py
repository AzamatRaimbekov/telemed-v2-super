from __future__ import annotations

import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Any, Optional

logger = structlog.get_logger()

# NOTE: In-memory store only works with a single worker process.
# For multi-worker deployments, replace with Redis or a DB table.
_pending_actions: dict[str, dict] = {}

ACTION_TTL_SECONDS = 300  # 5 minutes


def _cleanup_expired() -> None:
    """Remove expired actions to prevent memory leaks."""
    now = datetime.utcnow()
    expired = [
        aid
        for aid, action in _pending_actions.items()
        if (now - datetime.fromisoformat(action["created_at"])).total_seconds()
        > ACTION_TTL_SECONDS
    ]
    for aid in expired:
        _pending_actions.pop(aid, None)


def store_pending_action(
    action_id: str,
    action_type: str,
    params: dict,
    patient_id: uuid.UUID,
) -> None:
    """Store an action that requires user confirmation before execution."""
    _cleanup_expired()
    _pending_actions[action_id] = {
        "type": action_type,
        "params": params,
        "patient_id": str(patient_id),
        "created_at": datetime.utcnow().isoformat(),
    }


def get_pending_action(action_id: str) -> Optional[dict]:
    """Pop and return a pending action by its ID, or None if not found/expired."""
    action = _pending_actions.pop(action_id, None)
    if action is None:
        return None
    created = datetime.fromisoformat(action["created_at"])
    if (datetime.utcnow() - created).total_seconds() > ACTION_TTL_SECONDS:
        return None
    return action


async def execute_confirmed_action(
    action_id: str,
    patient_id: uuid.UUID,
    session: AsyncSession,
) -> dict[str, Any]:
    """Execute a previously confirmed action."""
    action = get_pending_action(action_id)
    if not action:
        return {"success": False, "message": "Действие не найдено или истекло"}

    if action["patient_id"] != str(patient_id):
        return {"success": False, "message": "Нет доступа"}

    action_type = action["type"]
    params = action["params"]

    try:
        if action_type == "book_appointment":
            # Will integrate with actual PortalService methods later
            logger.info(
                "action_book_appointment",
                params=params,
                patient_id=str(patient_id),
            )
            return {"success": True, "message": "Запись создана успешно"}

        elif action_type == "cancel_appointment":
            logger.info(
                "action_cancel_appointment",
                params=params,
                patient_id=str(patient_id),
            )
            return {"success": True, "message": "Запись отменена"}

        elif action_type == "send_message":
            logger.info(
                "action_send_message",
                params=params,
                patient_id=str(patient_id),
            )
            return {"success": True, "message": "Сообщение отправлено"}

        elif action_type == "pay_bill":
            logger.info(
                "action_pay_bill",
                params=params,
                patient_id=str(patient_id),
            )
            return {"success": True, "message": "Оплата инициирована"}

        else:
            return {
                "success": False,
                "message": f"Неизвестное действие: {action_type}",
            }

    except Exception as e:
        logger.error(
            "action_execution_error",
            action_type=action_type,
            error=str(e),
        )
        return {"success": False, "message": "Ошибка выполнения действия"}
