from __future__ import annotations
import uuid
import json
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.voice import (
    VoiceProcessRequest,
    VoiceProcessResponse,
    VoiceResponseType,
    VoiceAction,
)
from .ai_providers import GeminiProvider, DeepSeekProvider
from .ai_providers.base import AIProvider, AIResponse
from .context_builder import build_patient_context
from .action_executor import store_pending_action

logger = structlog.get_logger()

SYSTEM_PROMPT_TEMPLATE = """Ты — голосовой ассистент медицинского портала MedCore KG.
Пациент: {patient_name}
Текущая страница: {current_page}

Контекст пациента:
- Ближайшие приёмы: {upcoming_appointments}
- Активное лечение: {active_treatment}
- Последние анализы: {recent_results}
- Неоплаченные счета: {unpaid_bills}

Правила:
1. Отвечай кратко, 1-3 предложения
2. Отвечай на том же языке, на котором спросили
3. Ты НЕ врач — не ставь диагнозы, не давай медицинские рекомендации
4. Если вопрос выходит за рамки портала — вежливо скажи что не можешь помочь
5. Для действий используй function calling"""

AVAILABLE_FUNCTIONS = [
    {
        "name": "navigate",
        "description": "Перейти на страницу портала",
        "parameters": {
            "type": "object",
            "properties": {
                "route": {
                    "type": "string",
                    "description": "Route path, e.g. /portal/dashboard, /portal/treatment",
                }
            },
            "required": ["route"],
        },
    },
    {
        "name": "book_appointment",
        "description": "Записать пациента к врачу",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string", "description": "UUID врача"},
                "date": {"type": "string", "description": "Дата и время в ISO формате"},
            },
            "required": ["doctor_id", "date"],
        },
    },
    {
        "name": "cancel_appointment",
        "description": "Отменить запись к врачу",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "UUID записи"},
            },
            "required": ["appointment_id"],
        },
    },
    {
        "name": "send_message",
        "description": "Отправить сообщение врачу",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string", "description": "UUID врача"},
                "text": {"type": "string", "description": "Текст сообщения"},
            },
            "required": ["doctor_id", "text"],
        },
    },
    {
        "name": "pay_bill",
        "description": "Инициировать оплату счёта",
        "parameters": {
            "type": "object",
            "properties": {
                "bill_id": {"type": "string", "description": "UUID счёта"},
            },
            "required": ["bill_id"],
        },
    },
]

PAGE_HINTS: dict[str, dict[str, list[str]]] = {
    "dashboard": {
        "ru": ["Расписание", "Мои анализы", "Ближайший приём"],
        "ky": ["Расписание", "Анализдар", "Жакынкы кабыл алуу"],
        "en": ["Schedule", "My results", "Next appointment"],
    },
    "treatment": {
        "ru": ["План лечения", "Мои лекарства", "Следующая процедура"],
        "ky": ["Дарылоо планы", "Дарылар", "Кийинки процедура"],
        "en": ["Treatment plan", "My medications", "Next procedure"],
    },
    "schedule": {
        "ru": ["Записаться к врачу", "Ближайший приём", "Отменить запись"],
        "ky": ["Врачка жазылуу", "Жакынкы кабыл алуу", "Жазууну жокко чыгаруу"],
        "en": ["Book appointment", "Next appointment", "Cancel booking"],
    },
    "medical-card": {
        "ru": ["Мои диагнозы", "Аллергии", "История болезни"],
        "ky": ["Диагноздор", "Аллергиялар", "Оору тарыхы"],
        "en": ["My diagnoses", "Allergies", "Medical history"],
    },
    "results": {
        "ru": ["Последние анализы", "Результаты крови", "Скачать результат"],
        "ky": ["Акыркы анализдер", "Кан анализи", "Жүктөп алуу"],
        "en": ["Latest results", "Blood results", "Download result"],
    },
    "billing": {
        "ru": ["Неоплаченные счета", "Оплатить", "История платежей"],
        "ky": ["Төлөнбөгөн эсептер", "Төлөө", "Төлөм тарыхы"],
        "en": ["Unpaid bills", "Pay", "Payment history"],
    },
    "exercises": {
        "ru": ["Мои упражнения", "Показать видео", "План на сегодня"],
        "ky": ["Көнүгүүлөр", "Видео көрсөтүү", "Бүгүнкү план"],
        "en": ["My exercises", "Show video", "Today's plan"],
    },
    "appointments": {
        "ru": ["Записаться", "Свободные слоты", "К терапевту"],
        "ky": ["Жазылуу", "Бош убакыттар", "Терапевтке"],
        "en": ["Book", "Available slots", "To therapist"],
    },
    "history": {
        "ru": ["Последний визит", "Все визиты", "За этот месяц"],
        "ky": ["Акыркы визит", "Бардык визиттер", "Бул ай үчүн"],
        "en": ["Last visit", "All visits", "This month"],
    },
    "messages": {
        "ru": ["Новые сообщения", "Написать врачу", "Непрочитанные"],
        "ky": ["Жаңы билдирүүлөр", "Врачка жазуу", "Окулбаган"],
        "en": ["New messages", "Write to doctor", "Unread"],
    },
    "recovery": {
        "ru": ["Моя динамика", "Прогресс", "График восстановления"],
        "ky": ["Динамикам", "Прогресс", "Калыбына келтирүү графиги"],
        "en": ["My dynamics", "Progress", "Recovery chart"],
    },
    "profile": {
        "ru": ["Мои данные", "Сменить язык", "Настройки голоса"],
        "ky": ["Маалыматтар", "Тилди өзгөртүү", "Үн жөндөөлөрү"],
        "en": ["My data", "Change language", "Voice settings"],
    },
}


class VoiceAssistantService:
    def __init__(self):
        self.providers: list[AIProvider] = [
            GeminiProvider(
                api_key=settings.GEMINI_API_KEY,
                timeout=settings.VOICE_AI_TIMEOUT,
            ),
            DeepSeekProvider(
                api_key=settings.DEEPSEEK_API_KEY,
                timeout=settings.VOICE_AI_TIMEOUT,
            ),
        ]

    async def process(
        self,
        request: VoiceProcessRequest,
        patient_id: uuid.UUID,
        session: AsyncSession,
    ) -> VoiceProcessResponse:
        context = await build_patient_context(patient_id, session, request.page)

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            patient_name=context.get("patient_name", "Пациент"),
            current_page=context.get("current_page", ""),
            upcoming_appointments=json.dumps(context.get("upcoming_appointments", []), ensure_ascii=False),
            active_treatment=json.dumps(context.get("active_treatment", []), ensure_ascii=False),
            recent_results=json.dumps(context.get("recent_results", []), ensure_ascii=False),
            unpaid_bills=json.dumps(context.get("unpaid_bills", []), ensure_ascii=False),
        )

        ai_response = await self._call_ai_chain(request.text, system_prompt)

        if ai_response is None:
            return VoiceProcessResponse(
                type=VoiceResponseType.ERROR,
                text="AI-ассистент временно недоступен. Навигация голосом доступна.",
                fallback=True,
            )

        if ai_response.function_call:
            return self._handle_function_call(ai_response.function_call, patient_id)

        return VoiceProcessResponse(
            type=VoiceResponseType.ANSWER,
            text=ai_response.text,
        )

    async def _call_ai_chain(self, user_message: str, system_prompt: str) -> AIResponse | None:
        for provider in self.providers:
            if not await provider.is_available():
                continue
            response = await provider.generate(
                user_message=user_message,
                system_prompt=system_prompt,
                functions=AVAILABLE_FUNCTIONS,
            )
            if not response.error:
                logger.info("ai_provider_used", provider=provider.name)
                return response
            logger.warning("ai_provider_failed", provider=provider.name)
        return None

    def _handle_function_call(self, fc: dict, patient_id: uuid.UUID) -> VoiceProcessResponse:
        name = fc["name"]
        args = fc.get("args", {})

        if name == "navigate":
            return VoiceProcessResponse(
                type=VoiceResponseType.NAVIGATE,
                text="",
                route=args.get("route", "/portal/dashboard"),
            )

        action_id = str(uuid.uuid4())
        descriptions = {
            "book_appointment": f"Записать к врачу на {args.get('date', '')}",
            "cancel_appointment": "Отменить запись к врачу",
            "send_message": "Отправить сообщение врачу",
            "pay_bill": "Оплатить счёт",
        }

        store_pending_action(action_id, name, args, patient_id)

        return VoiceProcessResponse(
            type=VoiceResponseType.ACTION_CONFIRM,
            text=descriptions.get(name, f"Выполнить: {name}"),
            action=VoiceAction(
                id=action_id,
                type=name,
                description=descriptions.get(name, name),
                params=args,
            ),
        )

    @staticmethod
    def get_hints(page: str, language: str = "ru") -> list[str]:
        page_key = page.strip("/").split("/")[-1] if "/" in page else page
        page_hints = PAGE_HINTS.get(page_key, PAGE_HINTS.get("dashboard", {}))
        return page_hints.get(language, page_hints.get("ru", []))
