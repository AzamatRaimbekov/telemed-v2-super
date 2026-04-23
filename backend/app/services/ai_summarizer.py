import httpx
import json
from app.core.config import settings

SYSTEM_PROMPT = """Ты — медицинский ИИ-ассистент для клиники MedCore KG.
Тебе дана транскрипция разговора врача с пациентом на приёме.
Структурируй информацию в медицинскую запись.

Верни JSON с полями:
{
  "chief_complaint": "Основная жалоба пациента",
  "history_of_present_illness": "Анамнез заболевания — когда началось, как развивалось",
  "examination": "Данные осмотра — что врач обнаружил",
  "diagnosis": "Предварительный диагноз",
  "treatment_plan": "Назначенное лечение — лекарства, процедуры",
  "recommendations": "Рекомендации пациенту",
  "follow_up": "Когда следующий приём"
}

Если какое-то поле не упоминается в транскрипции — поставь null.
Пиши на русском языке. Будь точен и кратен."""


async def summarize_transcript(transcript: str) -> tuple[dict, str]:
    """Send transcript to AI and get structured summary.
    Returns (structured_summary_dict, model_name_used)."""

    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    deepseek_key = getattr(settings, "DEEPSEEK_API_KEY", "")

    if gemini_key:
        return await _summarize_gemini(transcript, gemini_key)
    elif deepseek_key:
        return await _summarize_deepseek(transcript, deepseek_key)
    else:
        # Fallback — return empty structure
        return _empty_summary(transcript), "none"


async def _summarize_gemini(transcript: str, api_key: str) -> tuple[dict, str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\nТранскрипция:\n{transcript}"}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text), "gemini-2.0-flash"


async def _summarize_deepseek(transcript: str, api_key: str) -> tuple[dict, str]:
    url = "https://api.deepseek.com/v1/chat/completions"
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Транскрипция:\n{transcript}"},
        ],
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url, json=payload, headers={"Authorization": f"Bearer {api_key}"}
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return json.loads(text), "deepseek-chat"


def _empty_summary(transcript: str) -> dict:
    return {
        "chief_complaint": None,
        "history_of_present_illness": None,
        "examination": None,
        "diagnosis": None,
        "treatment_plan": None,
        "recommendations": None,
        "follow_up": None,
        "raw_transcript": transcript,
    }
