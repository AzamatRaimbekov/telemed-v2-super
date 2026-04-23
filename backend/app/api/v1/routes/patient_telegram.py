from fastapi import APIRouter, Request
from app.services.patient_telegram_bot import PatientTelegramBot

router = APIRouter(prefix="/patient-telegram", tags=["Patient Telegram Bot"])

@router.post("/webhook")
async def patient_telegram_webhook(request: Request):
    """Webhook for patient Telegram bot."""
    body = await request.json()

    message = body.get("message", {})
    chat_id = str(message.get("chat", {}).get("id", ""))
    text = message.get("text", "")

    if not chat_id or not text:
        return {"ok": True}

    bot = PatientTelegramBot()
    response = await bot.handle_message(chat_id, text)
    await bot.send_message(chat_id, response)

    return {"ok": True}
