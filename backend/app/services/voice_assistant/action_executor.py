import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Any

logger = structlog.get_logger()

_pending_actions: dict[str, dict] = {}


def store_pending_action(
    action_id: str,
    action_type: str,
    params: dict,
    patient_id: uuid.UUID,
) -> None:
    """Store an action that requires user confirmation before execution."""
    _pending_actions[action_id] = {
        "type": action_type,
        "params": params,
        "patient_id": str(patient_id),
        "created_at": datetime.utcnow().isoformat(),
    }


def get_pending_action(action_id: str) -> dict | None:
    """Pop and return a pending action by its ID, or None if not found."""
    return _pending_actions.pop(action_id, None)


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
