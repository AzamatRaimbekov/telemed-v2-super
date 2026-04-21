from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Request
from sqlalchemy import select, update

from app.api.deps import CurrentUser, DBSession, RedisClient
from app.models.user import User

router = APIRouter(prefix="/telegram", tags=["Telegram Bot"])

# Redis key prefix for link tokens (TTL = 10 minutes)
LINK_TOKEN_PREFIX = "telegram_link:"
LINK_TOKEN_TTL = 600


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    session: DBSession,
):
    """Receive Telegram Bot updates (set via setWebhook).

    Handles the /start <token> command to link a Telegram chat_id
    to a MedCore user account.
    """
    import httpx
    from app.core.config import settings

    body = await request.json()
    message = body.get("message", {})
    text = message.get("text", "")
    chat_id = str(message.get("chat", {}).get("id", ""))

    if not chat_id or not text:
        return {"ok": True}

    # Handle /start <link_token>
    if text.startswith("/start "):
        token = text.split(" ", 1)[1].strip()
        if not token:
            return {"ok": True}

        # Look up token in Redis
        from redis.asyncio import Redis as AioRedis
        from app.core.redis import redis_pool

        redis = AioRedis(connection_pool=redis_pool)
        redis_key = f"{LINK_TOKEN_PREFIX}{token}"
        user_id_bytes = await redis.get(redis_key)

        if not user_id_bytes:
            # Token expired or invalid — notify user
            if settings.TELEGRAM_BOT_TOKEN:
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "Ссылка недействительна или истекла. Пожалуйста, создайте новую ссылку в системе MedCore.",
                        },
                    )
            return {"ok": True}

        user_id = str(user_id_bytes)

        # Link chat_id to user
        await session.execute(
            update(User)
            .where(User.id == uuid.UUID(user_id))
            .values(telegram_chat_id=chat_id)
        )
        await session.commit()
        await redis.delete(redis_key)

        # Confirm to user
        if settings.TELEGRAM_BOT_TOKEN:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": "Telegram успешно привязан к вашему аккаунту MedCore KG! Теперь вы будете получать уведомления здесь.",
                    },
                )

    return {"ok": True}


@router.post("/link")
async def generate_link_token(
    current_user: CurrentUser,
    redis: RedisClient,
):
    """Generate a one-time token for linking Telegram.

    The user opens https://t.me/<bot_username>?start=<token> to link.
    Token is valid for 10 minutes.
    """
    from app.core.config import settings

    token = secrets.token_urlsafe(32)
    redis_key = f"{LINK_TOKEN_PREFIX}{token}"
    await redis.set(redis_key, str(current_user.id), ex=LINK_TOKEN_TTL)

    bot_username = ""
    if settings.TELEGRAM_BOT_TOKEN:
        # Try to get bot username from Telegram API
        try:
            import httpx

            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe"
                )
                data = resp.json()
                bot_username = data.get("result", {}).get("username", "")
        except Exception:
            pass

    link = f"https://t.me/{bot_username}?start={token}" if bot_username else None

    return {
        "token": token,
        "link": link,
        "expires_in_seconds": LINK_TOKEN_TTL,
    }


@router.post("/unlink")
async def unlink_telegram(
    session: DBSession,
    current_user: CurrentUser,
):
    """Disconnect Telegram from the current user's account."""
    await session.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(telegram_chat_id=None)
    )
    await session.commit()
    return {"success": True, "message": "Telegram отвязан от аккаунта"}
