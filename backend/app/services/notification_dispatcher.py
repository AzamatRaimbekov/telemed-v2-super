from datetime import datetime, timezone

import httpx
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification_log import NotificationChannel, NotificationLog, NotificationStatus

logger = structlog.get_logger()


class NotificationDispatcher:
    """Unified dispatcher for outbound notifications (SMS, WhatsApp, Telegram, Email)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def send(
        self,
        channel: str,
        recipient: str,
        body: str,
        subject: str = None,
        clinic_id=None,
        related_type: str = None,
        related_id=None,
    ) -> NotificationLog:
        """Send a notification via the specified channel and log it."""
        log = NotificationLog(
            channel=channel,
            recipient=recipient,
            subject=subject,
            body=body,
            clinic_id=clinic_id,
            related_type=related_type,
            related_id=related_id,
            status=NotificationStatus.PENDING,
        )
        self.db.add(log)

        try:
            if channel == NotificationChannel.SMS:
                await self._send_sms(recipient, body)
            elif channel == NotificationChannel.WHATSAPP:
                await self._send_whatsapp(recipient, body)
            elif channel == NotificationChannel.TELEGRAM:
                await self._send_telegram(recipient, body)
            elif channel == NotificationChannel.EMAIL:
                await self._send_email(recipient, subject or "", body)
            elif channel == NotificationChannel.IN_APP:
                pass  # in-app notifications are handled separately

            log.status = NotificationStatus.SENT
            log.sent_at = datetime.now(timezone.utc)
            await logger.ainfo("notification_sent", channel=channel, recipient=recipient)
        except Exception as e:
            log.status = NotificationStatus.FAILED
            log.error_message = str(e)[:500]
            await logger.aerror("notification_failed", channel=channel, recipient=recipient, error=str(e))

        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def _send_sms(self, phone: str, message: str):
        """Send SMS via Nikita SMS gateway (common in Kyrgyzstan)."""
        if not settings.SMS_API_KEY:
            raise ValueError("SMS_API_KEY not configured")
        if not settings.SMS_API_URL:
            raise ValueError("SMS_API_URL not configured")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                settings.SMS_API_URL,
                json={
                    "api_key": settings.SMS_API_KEY,
                    "phone": phone,
                    "message": message,
                },
            )
            resp.raise_for_status()

    async def _send_whatsapp(self, phone: str, message: str):
        """Send WhatsApp message via WhatsApp Business Cloud API."""
        if not settings.WHATSAPP_API_TOKEN:
            raise ValueError("WHATSAPP_API_TOKEN not configured")
        if not settings.WHATSAPP_PHONE_NUMBER_ID:
            raise ValueError("WHATSAPP_PHONE_NUMBER_ID not configured")

        url = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "text",
                    "text": {"body": message},
                },
            )
            resp.raise_for_status()

    async def _send_telegram(self, chat_id: str, message: str):
        """Send Telegram message via Bot API."""
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            raise ValueError("TELEGRAM_BOT_TOKEN not configured")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            )
            resp.raise_for_status()

    async def _send_email(self, to: str, subject: str, body: str):
        """Send email via existing SMTP service."""
        from app.core.email import send_email

        success = await send_email(to, subject, body)
        if not success:
            raise ValueError("Email sending failed — SMTP not configured or error occurred")
