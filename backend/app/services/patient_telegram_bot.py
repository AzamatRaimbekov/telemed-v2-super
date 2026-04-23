"""Telegram bot for patients — book appointments, check lab results."""
import httpx
from app.core.config import settings


class PatientTelegramBot:
    """Handles patient commands via Telegram."""

    def __init__(self):
        self.token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")

    async def handle_message(self, chat_id: str, text: str, user_data: dict | None = None) -> str:
        """Process patient message and return response."""
        text_lower = text.lower().strip()

        if text_lower in ("/start", "начать"):
            return (
                "Добро пожаловать в MedCore KG! 🏥\n\n"
                "Доступные команды:\n"
                "/запись — Записаться на приём\n"
                "/анализы — Проверить результаты\n"
                "/приёмы — Мои предстоящие приёмы\n"
                "/лекарства — Напоминания о лекарствах\n"
                "/помощь — Список команд\n\n"
                "Для привязки аккаунта отправьте свой ИНН."
            )

        if text_lower in ("/помощь", "/help", "помощь"):
            return (
                "📋 Команды:\n"
                "/запись — Записаться к врачу\n"
                "/анализы — Результаты анализов\n"
                "/приёмы — Предстоящие приёмы\n"
                "/лекарства — Мои лекарства\n"
                "/клиника — Информация о клинике\n"
                "/отмена — Отменить запись"
            )

        if text_lower in ("/клиника", "клиника"):
            return (
                "🏥 MedCore Клиника\n"
                "📍 г. Бишкек, ул. Манаса 42\n"
                "📞 +996 312 123456\n"
                "🕐 Пн-Пт: 8:00-18:00, Сб: 9:00-14:00"
            )

        if text_lower.startswith("/запись") or "записаться" in text_lower:
            return (
                "📅 Для записи укажите:\n"
                "1. Специальность врача\n"
                "2. Желаемую дату\n\n"
                "Например: «Записаться к терапевту на понедельник»\n\n"
                "Или позвоните: +996 312 123456"
            )

        if text_lower.startswith("/анализы") or "анализ" in text_lower:
            return "🔬 Для проверки результатов привяжите аккаунт (отправьте ИНН) или зайдите в портал: portal.medcore.kg"

        if text_lower.startswith("/приёмы") or "приём" in text_lower:
            return "📋 Привяжите аккаунт для просмотра приёмов. Отправьте свой ИНН."

        return "Не понял команду. Отправьте /помощь для списка доступных команд."

    async def send_message(self, chat_id: str, text: str):
        """Send message to chat."""
        if not self.token:
            return
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
