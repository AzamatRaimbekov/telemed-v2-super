# Voice Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a voice-controlled assistant to the patient portal with navigation commands, AI-powered dialogue, and action execution with confirmation.

**Architecture:** Monolithic voice module. Frontend React Context wraps the portal layout, providing speech recognition (Web Speech API → Whisper fallback), local intent matching for navigation, and AI-powered dialogue via backend proxy to Gemini Flash / DeepSeek. Floating mic button + wake word activation. All AI keys stay on backend.

**Tech Stack:** React 18 + Zustand + TanStack Router/Query, FastAPI + httpx, Web Speech API, Whisper (self-hosted), Gemini Flash API, DeepSeek API, Framer Motion, Levenshtein fuzzy matching.

**Spec:** `docs/superpowers/specs/2026-04-16-voice-assistant-design.md`

---

## File Structure

### Frontend — New files

```
frontend/src/features/voice-assistant/
├── types.ts                         # VoiceState, Intent, AIResponse types
├── constants.ts                     # Wake words, timeouts, config
├── intents/
│   ├── navigation.ts                # Route patterns (3 languages)
│   ├── actions.ts                   # System command patterns
│   └── hints.ts                     # Per-page hint chips
├── utils/
│   └── levenshtein.ts               # Fuzzy string matching
├── hooks/
│   ├── useVoiceRecognition.ts       # Web Speech API + Whisper fallback
│   ├── useWakeWord.ts               # "Эй, Медкор" detector
│   ├── useIntentRouter.ts           # Local pattern matching
│   ├── useAIAssistant.ts            # Backend AI requests
│   └── useTextToSpeech.ts           # Browser TTS
├── components/
│   ├── VoiceAssistantProvider.tsx    # React Context wrapping portal
│   ├── FloatingMic.tsx              # Pulsing mic button
│   ├── SpeechBubble.tsx             # Transcript + AI response popup
│   ├── HintChips.tsx                # Contextual command suggestions
│   └── ConfirmationDialog.tsx       # Action confirmation modal
├── api.ts                           # Voice API client functions
└── index.ts                         # Public exports
```

### Backend — New files

```
backend/app/
├── api/v1/routes/portal_voice.py    # Voice endpoints
├── services/voice_assistant/
│   ├── __init__.py
│   ├── service.py                   # VoiceAssistantService orchestrator
│   ├── ai_providers/
│   │   ├── __init__.py
│   │   ├── base.py                  # Abstract AIProvider
│   │   ├── gemini_provider.py       # Gemini Flash
│   │   └── deepseek_provider.py     # DeepSeek
│   ├── context_builder.py           # Patient data aggregation
│   └── action_executor.py           # Confirmed action runner
└── schemas/voice.py                 # Pydantic request/response models
```

### Modified files

```
frontend/src/routes/portal/_portal.tsx          # Wrap with VoiceAssistantProvider
frontend/src/routes/portal/_portal/profile.tsx  # Add voice settings section
frontend/src/stores/portal-auth-store.ts        # Add voiceSettings to state
frontend/src/features/portal/api.ts             # Add voice settings endpoints
backend/app/core/config.py                      # Add GEMINI_API_KEY, DEEPSEEK_API_KEY
backend/app/models/patient.py                   # Add voice_settings column
backend/app/api/v1/routes/portal.py             # Add voice settings endpoints
backend/app/services/portal.py                  # Add voice settings methods
backend/app/api/v1/router.py                    # Register voice router
```

---

## Task 1: Backend — Config & Voice Schemas

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/schemas/voice.py`

- [ ] **Step 1: Add AI provider keys to config**

In `backend/app/core/config.py`, add these fields to the `Settings` class after the `OPENAI_API_KEY` line:

```python
    # Voice Assistant AI providers
    GEMINI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    WHISPER_MODEL_SIZE: str = "base"  # tiny, base, small, medium, large
    VOICE_AI_TIMEOUT: int = 5  # seconds
    VOICE_RATE_LIMIT: int = 30  # requests per minute per patient
```

- [ ] **Step 2: Create voice schemas**

Create `backend/app/schemas/voice.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class VoiceLanguage(str, Enum):
    RU = "ru"
    KY = "ky"
    EN = "en"


class VoiceResponseType(str, Enum):
    ANSWER = "answer"
    ACTION_CONFIRM = "action_confirm"
    NAVIGATE = "navigate"
    ERROR = "error"


class VoiceProcessRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: VoiceLanguage = VoiceLanguage.RU
    page: str = Field(..., description="Current portal page route")


class VoiceAction(BaseModel):
    id: str
    type: str  # book_appointment, cancel_appointment, pay_bill, send_message
    description: str
    params: dict


class VoiceProcessResponse(BaseModel):
    type: VoiceResponseType
    text: str
    action: Optional[VoiceAction] = None
    route: Optional[str] = None
    fallback: bool = False


class VoiceConfirmRequest(BaseModel):
    action_id: str
    confirmed: bool


class VoiceConfirmResponse(BaseModel):
    success: bool
    message: str


class WhisperRequest(BaseModel):
    pass  # Audio comes as FormData


class WhisperResponse(BaseModel):
    text: str
    language: str


class VoiceHintsResponse(BaseModel):
    hints: list[str]


class VoiceSettings(BaseModel):
    voice_enabled: bool = False
    wake_word_enabled: bool = False
    tts_enabled: bool = False
    language: VoiceLanguage = VoiceLanguage.RU
    tts_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    hint_size: str = Field(default="md", pattern="^(sm|md|lg)$")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py backend/app/schemas/voice.py
git commit -m "feat(voice): add config keys and Pydantic schemas"
```

---

## Task 2: Backend — AI Providers

**Files:**
- Create: `backend/app/services/voice_assistant/__init__.py`
- Create: `backend/app/services/voice_assistant/ai_providers/__init__.py`
- Create: `backend/app/services/voice_assistant/ai_providers/base.py`
- Create: `backend/app/services/voice_assistant/ai_providers/gemini_provider.py`
- Create: `backend/app/services/voice_assistant/ai_providers/deepseek_provider.py`

- [ ] **Step 1: Create package init files**

Create `backend/app/services/voice_assistant/__init__.py`:

```python
from .service import VoiceAssistantService

__all__ = ["VoiceAssistantService"]
```

Create `backend/app/services/voice_assistant/ai_providers/__init__.py`:

```python
from .base import AIProvider
from .gemini_provider import GeminiProvider
from .deepseek_provider import DeepSeekProvider

__all__ = ["AIProvider", "GeminiProvider", "DeepSeekProvider"]
```

- [ ] **Step 2: Create abstract base provider**

Create `backend/app/services/voice_assistant/ai_providers/base.py`:

```python
from abc import ABC, abstractmethod
from typing import Optional
import structlog

logger = structlog.get_logger()


class AIResponse:
    def __init__(
        self,
        text: str,
        function_call: Optional[dict] = None,
        error: bool = False,
    ):
        self.text = text
        self.function_call = function_call
        self.error = error


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def generate(
        self,
        user_message: str,
        system_prompt: str,
        functions: list[dict],
    ) -> AIResponse:
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        pass
```

- [ ] **Step 3: Create Gemini provider**

Create `backend/app/services/voice_assistant/ai_providers/gemini_provider.py`:

```python
import httpx
import structlog
from typing import Optional
from .base import AIProvider, AIResponse

logger = structlog.get_logger()

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str, timeout: int = 5):
        self.api_key = api_key
        self.timeout = timeout

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        user_message: str,
        system_prompt: str,
        functions: list[dict],
    ) -> AIResponse:
        if not self.api_key:
            return AIResponse(text="", error=True)

        tools = []
        if functions:
            tools = [{"function_declarations": functions}]

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
        }
        if tools:
            payload["tools"] = tools

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    GEMINI_API_URL,
                    params={"key": self.api_key},
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            candidate = data["candidates"][0]["content"]["parts"][0]

            if "functionCall" in candidate:
                fc = candidate["functionCall"]
                return AIResponse(
                    text="",
                    function_call={"name": fc["name"], "args": fc.get("args", {})},
                )

            return AIResponse(text=candidate.get("text", ""))

        except Exception as e:
            logger.warning("gemini_error", error=str(e))
            return AIResponse(text="", error=True)
```

- [ ] **Step 4: Create DeepSeek provider**

Create `backend/app/services/voice_assistant/ai_providers/deepseek_provider.py`:

```python
import httpx
import json
import structlog
from typing import Optional
from .base import AIProvider, AIResponse

logger = structlog.get_logger()

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class DeepSeekProvider(AIProvider):
    name = "deepseek"

    def __init__(self, api_key: str, timeout: int = 5):
        self.api_key = api_key
        self.timeout = timeout

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        user_message: str,
        system_prompt: str,
        functions: list[dict],
    ) -> AIResponse:
        if not self.api_key:
            return AIResponse(text="", error=True)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        payload: dict = {
            "model": "deepseek-chat",
            "messages": messages,
            "max_tokens": 300,
        }

        if functions:
            payload["tools"] = [
                {"type": "function", "function": f} for f in functions
            ]

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    DEEPSEEK_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            choice = data["choices"][0]["message"]

            if choice.get("tool_calls"):
                tc = choice["tool_calls"][0]["function"]
                return AIResponse(
                    text="",
                    function_call={
                        "name": tc["name"],
                        "args": json.loads(tc["arguments"]),
                    },
                )

            return AIResponse(text=choice.get("content", ""))

        except Exception as e:
            logger.warning("deepseek_error", error=str(e))
            return AIResponse(text="", error=True)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/voice_assistant/
git commit -m "feat(voice): add AI providers - Gemini Flash and DeepSeek"
```

---

## Task 3: Backend — Context Builder & Action Executor

**Files:**
- Create: `backend/app/services/voice_assistant/context_builder.py`
- Create: `backend/app/services/voice_assistant/action_executor.py`

- [ ] **Step 1: Create context builder**

Create `backend/app/services/voice_assistant/context_builder.py`:

```python
import uuid
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional

from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.treatment_plan import TreatmentPlan
from app.models.lab_result import LabResult
from app.models.billing import Invoice

import structlog

logger = structlog.get_logger()


async def build_patient_context(
    patient_id: uuid.UUID,
    session: AsyncSession,
    page: str,
) -> dict:
    """Build a concise patient context dict for the AI system prompt."""
    patient = await session.get(Patient, patient_id)
    if not patient:
        return {}

    context = {
        "patient_name": f"{patient.last_name} {patient.first_name}",
        "current_page": page,
    }

    try:
        # Upcoming appointments (next 7 days)
        now = datetime.utcnow()
        week_ahead = now + timedelta(days=7)
        appts_q = select(Appointment).where(
            and_(
                Appointment.patient_id == patient_id,
                Appointment.scheduled_time >= now,
                Appointment.scheduled_time <= week_ahead,
            )
        ).order_by(Appointment.scheduled_time).limit(5)
        appts_result = await session.execute(appts_q)
        appointments = appts_result.scalars().all()

        context["upcoming_appointments"] = [
            {
                "id": str(a.id),
                "doctor": f"{a.doctor.last_name} {a.doctor.first_name}" if a.doctor else "N/A",
                "specialization": a.doctor.specialization if a.doctor else None,
                "date": a.scheduled_time.strftime("%Y-%m-%d %H:%M"),
            }
            for a in appointments
        ]
    except Exception as e:
        logger.warning("context_appointments_error", error=str(e))
        context["upcoming_appointments"] = []

    try:
        # Active treatment plans
        plans_q = select(TreatmentPlan).where(
            and_(
                TreatmentPlan.patient_id == patient_id,
                TreatmentPlan.status == "ACTIVE",
            )
        ).limit(3)
        plans_result = await session.execute(plans_q)
        plans = plans_result.scalars().all()

        context["active_treatment"] = [
            {"title": p.title, "description": p.description}
            for p in plans
        ]
    except Exception as e:
        logger.warning("context_treatment_error", error=str(e))
        context["active_treatment"] = []

    try:
        # Recent lab results (last 30 days)
        month_ago = now - timedelta(days=30)
        labs_q = select(LabResult).where(
            and_(
                LabResult.patient_id == patient_id,
                LabResult.created_at >= month_ago,
            )
        ).order_by(LabResult.created_at.desc()).limit(5)
        labs_result = await session.execute(labs_q)
        labs = labs_result.scalars().all()

        context["recent_results"] = [
            {"name": r.test_name, "date": r.created_at.strftime("%Y-%m-%d"), "status": r.status}
            for r in labs
        ]
    except Exception as e:
        logger.warning("context_results_error", error=str(e))
        context["recent_results"] = []

    try:
        # Unpaid invoices
        inv_q = select(Invoice).where(
            and_(
                Invoice.patient_id == patient_id,
                Invoice.status == "PENDING",
            )
        ).limit(5)
        inv_result = await session.execute(inv_q)
        invoices = inv_result.scalars().all()

        context["unpaid_bills"] = [
            {"id": str(i.id), "amount": float(i.total_amount), "description": i.description}
            for i in invoices
        ]
    except Exception as e:
        logger.warning("context_bills_error", error=str(e))
        context["unpaid_bills"] = []

    return context
```

- [ ] **Step 2: Create action executor**

Create `backend/app/services/voice_assistant/action_executor.py`:

```python
import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Any

from app.services.portal import PortalService

logger = structlog.get_logger()

# In-memory store for pending actions (per-process; use Redis for multi-process)
_pending_actions: dict[str, dict] = {}


def store_pending_action(action_id: str, action_type: str, params: dict, patient_id: uuid.UUID) -> None:
    _pending_actions[action_id] = {
        "type": action_type,
        "params": params,
        "patient_id": str(patient_id),
        "created_at": datetime.utcnow().isoformat(),
    }


def get_pending_action(action_id: str) -> dict | None:
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
            result = await PortalService.create_appointment(
                patient_id=patient_id,
                doctor_id=uuid.UUID(params["doctor_id"]),
                scheduled_time=datetime.fromisoformat(params["date"]),
                session=session,
            )
            return {"success": True, "message": "Запись создана успешно"}

        elif action_type == "cancel_appointment":
            await PortalService.cancel_appointment(
                patient_id=patient_id,
                appointment_id=uuid.UUID(params["appointment_id"]),
                session=session,
            )
            return {"success": True, "message": "Запись отменена"}

        elif action_type == "send_message":
            await PortalService.send_message(
                patient_id=patient_id,
                recipient_id=uuid.UUID(params["doctor_id"]),
                content=params["text"],
                session=session,
            )
            return {"success": True, "message": "Сообщение отправлено"}

        else:
            return {"success": False, "message": f"Неизвестное действие: {action_type}"}

    except Exception as e:
        logger.error("action_execution_error", action_type=action_type, error=str(e))
        return {"success": False, "message": "Ошибка выполнения действия"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/voice_assistant/context_builder.py backend/app/services/voice_assistant/action_executor.py
git commit -m "feat(voice): add context builder and action executor"
```

---

## Task 4: Backend — VoiceAssistantService

**Files:**
- Create: `backend/app/services/voice_assistant/service.py`

- [ ] **Step 1: Create the main service**

Create `backend/app/services/voice_assistant/service.py`:

```python
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
]

# Page-specific hints
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
            "send_message": f"Отправить сообщение врачу",
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/voice_assistant/service.py
git commit -m "feat(voice): add VoiceAssistantService with AI chain and hints"
```

---

## Task 5: Backend — Voice API Routes

**Files:**
- Create: `backend/app/api/v1/routes/portal_voice.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create voice routes**

Create `backend/app/api/v1/routes/portal_voice.py`:

```python
import structlog
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_portal_patient
from app.models.patient import Patient
from app.schemas.voice import (
    VoiceProcessRequest,
    VoiceProcessResponse,
    VoiceConfirmRequest,
    VoiceConfirmResponse,
    WhisperResponse,
    VoiceHintsResponse,
    VoiceSettings,
)
from app.services.voice_assistant.service import VoiceAssistantService
from app.services.voice_assistant.action_executor import execute_confirmed_action

logger = structlog.get_logger()

router = APIRouter(prefix="/portal/voice", tags=["portal-voice"])

voice_service = VoiceAssistantService()


@router.post("/process", response_model=VoiceProcessResponse)
async def process_voice(
    request: VoiceProcessRequest,
    patient: Patient = Depends(get_current_portal_patient),
    session: AsyncSession = Depends(get_session),
):
    return await voice_service.process(request, patient.id, session)


@router.post("/confirm-action", response_model=VoiceConfirmResponse)
async def confirm_action(
    request: VoiceConfirmRequest,
    patient: Patient = Depends(get_current_portal_patient),
    session: AsyncSession = Depends(get_session),
):
    if not request.confirmed:
        return VoiceConfirmResponse(success=False, message="Действие отменено")
    result = await execute_confirmed_action(request.action_id, patient.id, session)
    return VoiceConfirmResponse(**result)


@router.post("/whisper", response_model=WhisperResponse)
async def whisper_stt(
    audio: UploadFile = File(...),
    patient: Patient = Depends(get_current_portal_patient),
):
    """Fallback STT via self-hosted Whisper. Placeholder — requires whisper installed."""
    try:
        import whisper

        model = whisper.load_model("base")
        # Save temp file, transcribe, delete
        import tempfile, os

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        result = model.transcribe(tmp_path)
        os.unlink(tmp_path)

        return WhisperResponse(
            text=result["text"].strip(),
            language=result.get("language", "ru"),
        )
    except ImportError:
        logger.warning("whisper_not_installed")
        return WhisperResponse(text="", language="ru")
    except Exception as e:
        logger.error("whisper_error", error=str(e))
        return WhisperResponse(text="", language="ru")


@router.get("/hints/{page}", response_model=VoiceHintsResponse)
async def get_hints(
    page: str,
    lang: str = "ru",
    patient: Patient = Depends(get_current_portal_patient),
):
    hints = VoiceAssistantService.get_hints(page, lang)
    return VoiceHintsResponse(hints=hints)


@router.get("/settings", response_model=VoiceSettings)
async def get_voice_settings(
    patient: Patient = Depends(get_current_portal_patient),
    session: AsyncSession = Depends(get_session),
):
    prefs = patient.voice_settings or {}
    return VoiceSettings(**prefs)


@router.put("/settings", response_model=VoiceSettings)
async def update_voice_settings(
    data: VoiceSettings,
    patient: Patient = Depends(get_current_portal_patient),
    session: AsyncSession = Depends(get_session),
):
    patient.voice_settings = data.model_dump()
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return VoiceSettings(**patient.voice_settings)
```

- [ ] **Step 2: Register voice router**

In `backend/app/api/v1/router.py`, add the import and include:

```python
from app.api.v1.routes.portal_voice import router as portal_voice_router
```

Add to the router includes (after other portal routes):

```python
api_router.include_router(portal_voice_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/portal_voice.py backend/app/api/v1/router.py
git commit -m "feat(voice): add voice API routes and register router"
```

---

## Task 6: Backend — Patient Model Update & Migration

**Files:**
- Modify: `backend/app/models/patient.py`
- Create: Alembic migration

- [ ] **Step 1: Add voice_settings column to Patient model**

In `backend/app/models/patient.py`, add after the `notification_preferences` field:

```python
    voice_settings = Column(JSON, nullable=True, default=None)
```

- [ ] **Step 2: Create Alembic migration**

Run:

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
alembic revision --autogenerate -m "add voice_settings to patients"
```

Verify the generated migration contains `op.add_column('patients', sa.Column('voice_settings', sa.JSON(), nullable=True))`.

- [ ] **Step 3: Apply migration**

Run:

```bash
cd /Users/azamat/Desktop/telemed-v2-super/backend
alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/patient.py backend/alembic/versions/
git commit -m "feat(voice): add voice_settings column to patients table"
```

---

## Task 7: Frontend — Types, Constants & Intent Definitions

**Files:**
- Create: `frontend/src/features/voice-assistant/types.ts`
- Create: `frontend/src/features/voice-assistant/constants.ts`
- Create: `frontend/src/features/voice-assistant/intents/navigation.ts`
- Create: `frontend/src/features/voice-assistant/intents/actions.ts`
- Create: `frontend/src/features/voice-assistant/intents/hints.ts`
- Create: `frontend/src/features/voice-assistant/utils/levenshtein.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/features/voice-assistant/types.ts`:

```typescript
export type VoiceLanguage = "ru" | "ky" | "en";

export type VoiceStatus = "idle" | "listening" | "processing" | "error";

export type VoiceResponseType = "answer" | "action_confirm" | "navigate" | "error";

export interface VoiceAction {
  id: string;
  type: string;
  description: string;
  params: Record<string, unknown>;
}

export interface VoiceProcessResponse {
  type: VoiceResponseType;
  text: string;
  action?: VoiceAction;
  route?: string;
  fallback?: boolean;
}

export interface VoiceSettings {
  voice_enabled: boolean;
  wake_word_enabled: boolean;
  tts_enabled: boolean;
  language: VoiceLanguage;
  tts_speed: number;
  hint_size: "sm" | "md" | "lg";
}

export interface VoiceContextValue {
  status: VoiceStatus;
  transcript: string;
  aiResponse: string | null;
  pendingAction: VoiceAction | null;
  settings: VoiceSettings;
  startListening: () => void;
  stopListening: () => void;
  confirmAction: (confirmed: boolean) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
}
```

- [ ] **Step 2: Create constants**

Create `frontend/src/features/voice-assistant/constants.ts`:

```typescript
import type { VoiceSettings } from "./types";

export const WAKE_WORDS: Record<string, string[]> = {
  ru: ["медкор", "эй медкор", "привет медкор"],
  ky: ["медкор", "эй медкор"],
  en: ["medcore", "hey medcore"],
};

export const SILENCE_TIMEOUT_MS = 10_000;
export const CONFIDENCE_THRESHOLD = 0.6;
export const MIC_BUTTON_SIZE = 56;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice_enabled: false,
  wake_word_enabled: false,
  tts_enabled: false,
  language: "ru",
  tts_speed: 1.0,
  hint_size: "md",
};

export const SPEECH_LANG_MAP: Record<string, string> = {
  ru: "ru-RU",
  ky: "ky-KG",
  en: "en-US",
};
```

- [ ] **Step 3: Create navigation intents**

Create `frontend/src/features/voice-assistant/intents/navigation.ts`:

```typescript
export interface NavigationIntent {
  patterns: Record<string, string[]>;
  route: string;
}

export const navigationIntents: Record<string, NavigationIntent> = {
  dashboard: {
    patterns: {
      ru: ["главная", "домой", "на главную", "дашборд"],
      ky: ["башкы бет", "үйгө", "башкы"],
      en: ["home", "dashboard", "main page", "main"],
    },
    route: "/portal/dashboard",
  },
  treatment: {
    patterns: {
      ru: ["лечение", "мое лечение", "план лечения", "лекарства"],
      ky: ["дарылоо", "дарылоо планы", "дары"],
      en: ["treatment", "my treatment", "medications"],
    },
    route: "/portal/treatment",
  },
  schedule: {
    patterns: {
      ru: ["расписание", "календарь", "приёмы", "приемы"],
      ky: ["расписание", "календарь", "кабыл алуу"],
      en: ["schedule", "calendar", "appointments"],
    },
    route: "/portal/schedule",
  },
  medicalCard: {
    patterns: {
      ru: ["медицинская карта", "мед карта", "медкарта", "карта"],
      ky: ["медициналык карта", "мед карта"],
      en: ["medical card", "med card", "health record"],
    },
    route: "/portal/medical-card",
  },
  results: {
    patterns: {
      ru: ["анализы", "результаты", "мои анализы", "лаборатория"],
      ky: ["анализдер", "жыйынтыктар", "лаборатория"],
      en: ["results", "lab results", "tests", "my results"],
    },
    route: "/portal/results",
  },
  billing: {
    patterns: {
      ru: ["счета", "оплата", "биллинг", "мои счета"],
      ky: ["эсептер", "төлөм", "төлөө"],
      en: ["billing", "invoices", "payments", "my bills"],
    },
    route: "/portal/billing",
  },
  exercises: {
    patterns: {
      ru: ["упражнения", "мои упражнения", "тренировки", "зарядка"],
      ky: ["көнүгүүлөр", "машыгуулар"],
      en: ["exercises", "my exercises", "workouts"],
    },
    route: "/portal/exercises",
  },
  appointments: {
    patterns: {
      ru: ["записи", "записаться", "запись к врачу", "записаться к врачу"],
      ky: ["жазылуу", "врачка жазылуу"],
      en: ["book", "book appointment", "make appointment"],
    },
    route: "/portal/appointments",
  },
  history: {
    patterns: {
      ru: ["история", "история визитов", "визиты", "прошлые приёмы"],
      ky: ["тарых", "визиттер", "өткөн кабыл алуулар"],
      en: ["history", "visit history", "past visits"],
    },
    route: "/portal/history",
  },
  messages: {
    patterns: {
      ru: ["сообщения", "мои сообщения", "чат", "написать врачу"],
      ky: ["билдирүүлөр", "кабарлар", "врачка жазуу"],
      en: ["messages", "my messages", "chat", "write to doctor"],
    },
    route: "/portal/messages",
  },
  recovery: {
    patterns: {
      ru: ["динамика", "восстановление", "прогресс", "моя динамика"],
      ky: ["динамика", "калыбына келтирүү", "прогресс"],
      en: ["recovery", "dynamics", "progress", "my recovery"],
    },
    route: "/portal/recovery",
  },
  profile: {
    patterns: {
      ru: ["профиль", "мой профиль", "настройки", "мои данные"],
      ky: ["профиль", "жөндөөлөр", "маалыматтар"],
      en: ["profile", "my profile", "settings", "my data"],
    },
    route: "/portal/profile",
  },
};
```

- [ ] **Step 4: Create action intents**

Create `frontend/src/features/voice-assistant/intents/actions.ts`:

```typescript
export interface ActionIntent {
  patterns: Record<string, string[]>;
  execute: () => void;
}

export function createActionIntents(callbacks: {
  goBack: () => void;
  refresh: () => void;
  logout: () => void;
  showHelp: () => void;
}): ActionIntent[] {
  return [
    {
      patterns: {
        ru: ["назад", "вернуться", "обратно"],
        ky: ["артка", "кайтуу"],
        en: ["back", "go back"],
      },
      execute: callbacks.goBack,
    },
    {
      patterns: {
        ru: ["обновить", "обнови", "перезагрузить"],
        ky: ["жаңылоо", "жаңырт"],
        en: ["refresh", "reload"],
      },
      execute: callbacks.refresh,
    },
    {
      patterns: {
        ru: ["выйти", "выход", "разлогиниться"],
        ky: ["чыгуу", "чыгып кетүү"],
        en: ["logout", "sign out", "log out"],
      },
      execute: callbacks.logout,
    },
    {
      patterns: {
        ru: ["помощь", "помоги", "что ты умеешь", "команды"],
        ky: ["жардам", "жардам бер"],
        en: ["help", "what can you do", "commands"],
      },
      execute: callbacks.showHelp,
    },
  ];
}
```

- [ ] **Step 5: Create hints mapping**

Create `frontend/src/features/voice-assistant/intents/hints.ts`:

```typescript
import type { VoiceLanguage } from "../types";

const PAGE_HINTS: Record<string, Record<VoiceLanguage, string[]>> = {
  dashboard: {
    ru: ["Расписание", "Мои анализы", "Ближайший приём"],
    ky: ["Расписание", "Анализдар", "Жакынкы кабыл алуу"],
    en: ["Schedule", "My results", "Next appointment"],
  },
  treatment: {
    ru: ["План лечения", "Мои лекарства", "Следующая процедура"],
    ky: ["Дарылоо планы", "Дарылар", "Кийинки процедура"],
    en: ["Treatment plan", "My medications", "Next procedure"],
  },
  schedule: {
    ru: ["Записаться к врачу", "Ближайший приём", "Отменить запись"],
    ky: ["Врачка жазылуу", "Жакынкы кабыл алуу", "Жазууну жокко чыгаруу"],
    en: ["Book appointment", "Next appointment", "Cancel booking"],
  },
  "medical-card": {
    ru: ["Мои диагнозы", "Аллергии", "История болезни"],
    ky: ["Диагноздор", "Аллергиялар", "Оору тарыхы"],
    en: ["My diagnoses", "Allergies", "Medical history"],
  },
  results: {
    ru: ["Последние анализы", "Результаты крови", "Скачать результат"],
    ky: ["Акыркы анализдер", "Кан анализи", "Жүктөп алуу"],
    en: ["Latest results", "Blood results", "Download result"],
  },
  billing: {
    ru: ["Неоплаченные счета", "Оплатить", "История платежей"],
    ky: ["Төлөнбөгөн эсептер", "Төлөө", "Төлөм тарыхы"],
    en: ["Unpaid bills", "Pay", "Payment history"],
  },
  exercises: {
    ru: ["Мои упражнения", "Показать видео", "План на сегодня"],
    ky: ["Көнүгүүлөр", "Видео көрсөтүү", "Бүгүнкү план"],
    en: ["My exercises", "Show video", "Today's plan"],
  },
  appointments: {
    ru: ["Записаться", "Свободные слоты", "К терапевту"],
    ky: ["Жазылуу", "Бош убакыттар", "Терапевтке"],
    en: ["Book", "Available slots", "To therapist"],
  },
  history: {
    ru: ["Последний визит", "Все визиты", "За этот месяц"],
    ky: ["Акыркы визит", "Бардык визиттер", "Бул ай үчүн"],
    en: ["Last visit", "All visits", "This month"],
  },
  messages: {
    ru: ["Новые сообщения", "Написать врачу", "Непрочитанные"],
    ky: ["Жаңы билдирүүлөр", "Врачка жазуу", "Окулбаган"],
    en: ["New messages", "Write to doctor", "Unread"],
  },
  recovery: {
    ru: ["Моя динамика", "Прогресс", "График восстановления"],
    ky: ["Динамикам", "Прогресс", "Калыбына келтирүү графиги"],
    en: ["My dynamics", "Progress", "Recovery chart"],
  },
  profile: {
    ru: ["Мои данные", "Сменить язык", "Настройки голоса"],
    ky: ["Маалыматтар", "Тилди өзгөртүү", "Үн жөндөөлөрү"],
    en: ["My data", "Change language", "Voice settings"],
  },
};

export function getHintsForPage(page: string, language: VoiceLanguage): string[] {
  const pageKey = page.includes("/") ? page.split("/").pop() || "dashboard" : page;
  const hints = PAGE_HINTS[pageKey] || PAGE_HINTS.dashboard;
  return hints[language] || hints.ru;
}
```

- [ ] **Step 6: Create Levenshtein utility**

Create `frontend/src/features/voice-assistant/utils/levenshtein.ts`:

```typescript
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(input: string, patterns: string[], maxDistance = 2): string | null {
  const normalized = input.toLowerCase().trim();
  for (const pattern of patterns) {
    if (normalized === pattern) return pattern;
  }
  for (const pattern of patterns) {
    if (levenshtein(normalized, pattern) <= maxDistance) return pattern;
  }
  return null;
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/voice-assistant/types.ts frontend/src/features/voice-assistant/constants.ts frontend/src/features/voice-assistant/intents/ frontend/src/features/voice-assistant/utils/
git commit -m "feat(voice): add types, constants, intents and fuzzy matching"
```

---

## Task 8: Frontend — Voice API Client

**Files:**
- Create: `frontend/src/features/voice-assistant/api.ts`
- Modify: `frontend/src/features/portal/api.ts`

- [ ] **Step 1: Create voice API client**

Create `frontend/src/features/voice-assistant/api.ts`:

```typescript
import portalClient from "@/lib/portal-api-client";
import type { VoiceProcessResponse, VoiceSettings } from "./types";

export async function processVoice(
  text: string,
  language: string,
  page: string,
): Promise<VoiceProcessResponse> {
  const { data } = await portalClient.post<VoiceProcessResponse>("/portal/voice/process", {
    text,
    language,
    page,
  });
  return data;
}

export async function confirmVoiceAction(
  actionId: string,
  confirmed: boolean,
): Promise<{ success: boolean; message: string }> {
  const { data } = await portalClient.post("/portal/voice/confirm-action", {
    action_id: actionId,
    confirmed,
  });
  return data;
}

export async function whisperSTT(audioBlob: Blob): Promise<{ text: string; language: string }> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  const { data } = await portalClient.post("/portal/voice/whisper", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getVoiceHints(page: string, lang: string): Promise<string[]> {
  const { data } = await portalClient.get<{ hints: string[] }>(`/portal/voice/hints/${page}`, {
    params: { lang },
  });
  return data.hints;
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const { data } = await portalClient.get<VoiceSettings>("/portal/voice/settings");
  return data;
}

export async function updateVoiceSettings(settings: VoiceSettings): Promise<VoiceSettings> {
  const { data } = await portalClient.put<VoiceSettings>("/portal/voice/settings", settings);
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/voice-assistant/api.ts
git commit -m "feat(voice): add voice API client functions"
```

---

## Task 9: Frontend — Hooks

**Files:**
- Create: `frontend/src/features/voice-assistant/hooks/useVoiceRecognition.ts`
- Create: `frontend/src/features/voice-assistant/hooks/useWakeWord.ts`
- Create: `frontend/src/features/voice-assistant/hooks/useIntentRouter.ts`
- Create: `frontend/src/features/voice-assistant/hooks/useAIAssistant.ts`
- Create: `frontend/src/features/voice-assistant/hooks/useTextToSpeech.ts`

- [ ] **Step 1: Create useVoiceRecognition hook**

Create `frontend/src/features/voice-assistant/hooks/useVoiceRecognition.ts`:

```typescript
import { useState, useRef, useCallback, useEffect } from "react";
import { SPEECH_LANG_MAP, SILENCE_TIMEOUT_MS, CONFIDENCE_THRESHOLD } from "../constants";
import { whisperSTT } from "../api";
import type { VoiceLanguage } from "../types";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface UseVoiceRecognitionOptions {
  language: VoiceLanguage;
  onResult: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition({ language, onResult, onError }: UseVoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          try {
            const result = await whisperSTT(blob);
            if (result.text) onResult(result.text);
          } catch {
            onError?.("Не удалось распознать речь");
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      onError?.("Нет доступа к микрофону");
    }
  }, [onResult, onError]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!isSupported) {
      startFallbackRecording();
      setIsListening(true);
      silenceTimerRef.current = setTimeout(stop, SILENCE_TIMEOUT_MS);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG_MAP[language] || "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      if (result[0].confidence >= CONFIDENCE_THRESHOLD) {
        onResult(result[0].transcript.trim());
      }
      stop();
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === "no-speech") {
        stop();
        return;
      }
      if (event.error === "not-allowed") {
        onError?.("Разрешите доступ к микрофону в настройках браузера");
      } else {
        startFallbackRecording();
      }
      stop();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);

    silenceTimerRef.current = setTimeout(stop, SILENCE_TIMEOUT_MS);
  }, [isSupported, language, onResult, onError, stop, startFallbackRecording]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isListening, isSupported, start, stop };
}
```

- [ ] **Step 2: Create useWakeWord hook**

Create `frontend/src/features/voice-assistant/hooks/useWakeWord.ts`:

```typescript
import { useRef, useEffect, useCallback } from "react";
import { WAKE_WORDS, SPEECH_LANG_MAP } from "../constants";
import { fuzzyMatch } from "../utils/levenshtein";
import type { VoiceLanguage } from "../types";

interface UseWakeWordOptions {
  enabled: boolean;
  language: VoiceLanguage;
  onWakeWord: () => void;
}

export function useWakeWord({ enabled, language, onWakeWord }: UseWakeWordOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isActiveRef = useRef(false);

  const stopWakeWord = useCallback(() => {
    if (recognitionRef.current) {
      isActiveRef.current = false;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopWakeWord();
      return;
    }

    const isSupported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const startListening = () => {
      if (isActiveRef.current) return;

      const recognition = new SpeechRecognition();
      recognition.lang = SPEECH_LANG_MAP[language] || "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          const words = WAKE_WORDS[language] || WAKE_WORDS.ru;
          if (fuzzyMatch(transcript, words, 2)) {
            stopWakeWord();
            onWakeWord();
            return;
          }
        }
      };

      recognition.onerror = () => {
        isActiveRef.current = false;
      };

      recognition.onend = () => {
        if (isActiveRef.current && enabled) {
          setTimeout(startListening, 500);
        }
      };

      recognitionRef.current = recognition;
      isActiveRef.current = true;
      recognition.start();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startListening();
      } else {
        stopWakeWord();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (document.visibilityState === "visible") {
      startListening();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopWakeWord();
    };
  }, [enabled, language, onWakeWord, stopWakeWord]);

  return { stop: stopWakeWord };
}
```

- [ ] **Step 3: Create useIntentRouter hook**

Create `frontend/src/features/voice-assistant/hooks/useIntentRouter.ts`:

```typescript
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { navigationIntents } from "../intents/navigation";
import { createActionIntents } from "../intents/actions";
import { fuzzyMatch } from "../utils/levenshtein";
import { usePortalAuthStore } from "@/stores/portal-auth-store";
import type { VoiceLanguage } from "../types";

interface UseIntentRouterOptions {
  language: VoiceLanguage;
  onShowHelp: () => void;
}

interface IntentResult {
  matched: boolean;
  type?: "navigate" | "action";
  route?: string;
}

export function useIntentRouter({ language, onShowHelp }: UseIntentRouterOptions) {
  const navigate = useNavigate();
  const logout = usePortalAuthStore((s) => s.logout);

  const processIntent = useCallback(
    (text: string): IntentResult => {
      const normalized = text.toLowerCase().trim();

      // Check navigation intents
      for (const intent of Object.values(navigationIntents)) {
        const patterns = intent.patterns[language] || intent.patterns.ru;
        if (fuzzyMatch(normalized, patterns, 2)) {
          navigate({ to: intent.route });
          return { matched: true, type: "navigate", route: intent.route };
        }
      }

      // Check action intents
      const actionIntents = createActionIntents({
        goBack: () => window.history.back(),
        refresh: () => window.location.reload(),
        logout: () => logout(),
        showHelp: onShowHelp,
      });

      for (const action of actionIntents) {
        const patterns = action.patterns[language] || action.patterns.ru;
        if (fuzzyMatch(normalized, patterns, 2)) {
          action.execute();
          return { matched: true, type: "action" };
        }
      }

      return { matched: false };
    },
    [language, navigate, logout, onShowHelp],
  );

  return { processIntent };
}
```

- [ ] **Step 4: Create useAIAssistant hook**

Create `frontend/src/features/voice-assistant/hooks/useAIAssistant.ts`:

```typescript
import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { processVoice, confirmVoiceAction } from "../api";
import type { VoiceAction, VoiceLanguage, VoiceProcessResponse } from "../types";

interface UseAIAssistantOptions {
  language: VoiceLanguage;
  currentPage: string;
}

export function useAIAssistant({ language, currentPage }: UseAIAssistantOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<VoiceAction | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const navigate = useNavigate();

  const ask = useCallback(
    async (text: string) => {
      setIsProcessing(true);
      setResponse(null);
      setPendingAction(null);

      try {
        const result: VoiceProcessResponse = await processVoice(text, language, currentPage);

        if (result.fallback) {
          setIsFallback(true);
          setResponse("AI-ассистент временно недоступен. Навигация голосом доступна.");
          return;
        }

        setIsFallback(false);

        switch (result.type) {
          case "answer":
            setResponse(result.text);
            break;
          case "navigate":
            if (result.route) navigate({ to: result.route });
            break;
          case "action_confirm":
            setResponse(result.text);
            if (result.action) setPendingAction(result.action);
            break;
          case "error":
            setResponse(result.text || "Произошла ошибка");
            break;
        }
      } catch {
        setResponse("Не удалось связаться с сервером");
        setIsFallback(true);
      } finally {
        setIsProcessing(false);
      }
    },
    [language, currentPage, navigate],
  );

  const confirm = useCallback(
    async (confirmed: boolean) => {
      if (!pendingAction) return;
      try {
        const result = await confirmVoiceAction(pendingAction.id, confirmed);
        setResponse(result.message);
      } catch {
        setResponse("Ошибка выполнения действия");
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction],
  );

  const clearResponse = useCallback(() => {
    setResponse(null);
    setPendingAction(null);
  }, []);

  return { isProcessing, response, pendingAction, isFallback, ask, confirm, clearResponse };
}
```

- [ ] **Step 5: Create useTextToSpeech hook**

Create `frontend/src/features/voice-assistant/hooks/useTextToSpeech.ts`:

```typescript
import { useRef, useCallback } from "react";

interface UseTextToSpeechOptions {
  enabled: boolean;
  language: string;
  speed: number;
}

export function useTextToSpeech({ enabled, language, speed }: UseTextToSpeechOptions) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ky" ? "ky-KG" : language === "en" ? "en-US" : "ru-RU";
      utterance.rate = speed;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, language, speed],
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const isSpeaking = useCallback(() => {
    return window.speechSynthesis.speaking;
  }, []);

  return { speak, stop, isSpeaking };
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/voice-assistant/hooks/
git commit -m "feat(voice): add voice hooks - recognition, wake word, intent, AI, TTS"
```

---

## Task 10: Frontend — UI Components

**Files:**
- Create: `frontend/src/features/voice-assistant/components/FloatingMic.tsx`
- Create: `frontend/src/features/voice-assistant/components/SpeechBubble.tsx`
- Create: `frontend/src/features/voice-assistant/components/HintChips.tsx`
- Create: `frontend/src/features/voice-assistant/components/ConfirmationDialog.tsx`

- [ ] **Step 1: Create FloatingMic**

Create `frontend/src/features/voice-assistant/components/FloatingMic.tsx`:

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import type { VoiceStatus } from "../types";
import { MIC_BUTTON_SIZE } from "../constants";

interface FloatingMicProps {
  status: VoiceStatus;
  onClick: () => void;
}

export function FloatingMic({ status, onClick }: FloatingMicProps) {
  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const isError = status === "error";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      <motion.button
        onClick={onClick}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center rounded-full shadow-lg
          transition-colors duration-200
          ${isListening ? "bg-[var(--color-danger)] text-white" : ""}
          ${isProcessing ? "bg-[var(--color-muted)] text-[var(--color-text-secondary)] cursor-wait" : ""}
          ${isError ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" : ""}
          ${status === "idle" ? "bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-deep)]" : ""}
        `}
        style={{ width: MIC_BUTTON_SIZE, height: MIC_BUTTON_SIZE }}
        whileTap={{ scale: 0.9 }}
        aria-label={isListening ? "Остановить запись" : "Начать голосовую команду"}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="h-6 w-6 animate-spin" />
            </motion.div>
          ) : isListening ? (
            <motion.div key="mic-off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <MicOff className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Mic className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {isListening && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--color-danger)]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--color-danger)]"
              animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 2: Create SpeechBubble**

Create `frontend/src/features/voice-assistant/components/SpeechBubble.tsx`:

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SpeechBubbleProps {
  transcript: string;
  response: string | null;
  visible: boolean;
  onClose: () => void;
}

export function SpeechBubble({ transcript, response, visible, onClose }: SpeechBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (transcript || response) && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-20 right-6 z-50 max-w-sm w-72"
        >
          <div className="rounded-2xl bg-[var(--color-surface)] shadow-xl border border-[var(--color-border)] p-4">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            {transcript && (
              <div className="mb-2">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Вы сказали:</p>
                <p className="text-sm text-[var(--color-text-primary)]">{transcript}</p>
              </div>
            )}

            {response && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Ассистент:</p>
                <p className="text-sm text-[var(--color-text-primary)]">{response}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Create HintChips**

Create `frontend/src/features/voice-assistant/components/HintChips.tsx`:

```tsx
import { motion, AnimatePresence } from "framer-motion";

interface HintChipsProps {
  hints: string[];
  visible: boolean;
  size: "sm" | "md" | "lg";
  onHintClick: (hint: string) => void;
}

const sizeClasses = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-3 py-1.5",
  lg: "text-base px-4 py-2",
};

export function HintChips({ hints, visible, size, onHintClick }: HintChipsProps) {
  return (
    <AnimatePresence>
      {visible && hints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 right-6 z-50 flex flex-wrap gap-2 max-w-xs justify-end"
        >
          {hints.slice(0, 3).map((hint, i) => (
            <motion.button
              key={hint}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onHintClick(hint)}
              className={`
                rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]
                text-[var(--color-text-secondary)] shadow-sm
                hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]
                hover:border-[var(--color-primary-deep)] transition-colors
                ${sizeClasses[size]}
              `}
            >
              {hint}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Create ConfirmationDialog**

Create `frontend/src/features/voice-assistant/components/ConfirmationDialog.tsx`:

```tsx
import { motion, AnimatePresence } from "framer-motion";
import type { VoiceAction } from "../types";

interface ConfirmationDialogProps {
  action: VoiceAction | null;
  onConfirm: (confirmed: boolean) => void;
}

export function ConfirmationDialog({ action, onConfirm }: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[var(--color-surface)] rounded-2xl shadow-xl p-6 max-w-sm mx-4"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Подтверждение
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {action.description}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => onConfirm(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-deep)] transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/voice-assistant/components/
git commit -m "feat(voice): add UI components - FloatingMic, SpeechBubble, HintChips, ConfirmationDialog"
```

---

## Task 11: Frontend — VoiceAssistantProvider & Integration

**Files:**
- Create: `frontend/src/features/voice-assistant/components/VoiceAssistantProvider.tsx`
- Create: `frontend/src/features/voice-assistant/index.ts`
- Modify: `frontend/src/routes/portal/_portal.tsx`

- [ ] **Step 1: Create VoiceAssistantProvider**

Create `frontend/src/features/voice-assistant/components/VoiceAssistantProvider.tsx`:

```tsx
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "@tanstack/react-router";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";
import { useWakeWord } from "../hooks/useWakeWord";
import { useIntentRouter } from "../hooks/useIntentRouter";
import { useAIAssistant } from "../hooks/useAIAssistant";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { getHintsForPage } from "../intents/hints";
import { DEFAULT_VOICE_SETTINGS } from "../constants";
import { getVoiceSettings, updateVoiceSettings } from "../api";
import { FloatingMic } from "./FloatingMic";
import { SpeechBubble } from "./SpeechBubble";
import { HintChips } from "./HintChips";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { VoiceContextValue, VoiceSettings, VoiceStatus } from "../types";

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceAssistant(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceAssistant must be used within VoiceAssistantProvider");
  return ctx;
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem("voice_settings");
    return saved ? JSON.parse(saved) : DEFAULT_VOICE_SETTINGS;
  });
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const location = useLocation();
  const currentPage = location.pathname;

  // Load settings from server on mount
  useEffect(() => {
    getVoiceSettings()
      .then((s) => {
        setSettings(s);
        localStorage.setItem("voice_settings", JSON.stringify(s));
      })
      .catch(() => {});
  }, []);

  const handleUpdateSettings = useCallback(async (partial: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("voice_settings", JSON.stringify(next));
      updateVoiceSettings(next).catch(() => {});
      return next;
    });
  }, []);

  const { processIntent } = useIntentRouter({
    language: settings.language,
    onShowHelp: () => setShowHelp(true),
  });

  const ai = useAIAssistant({
    language: settings.language,
    currentPage,
  });

  const tts = useTextToSpeech({
    enabled: settings.tts_enabled,
    language: settings.language,
    speed: settings.tts_speed,
  });

  const handleVoiceResult = useCallback(
    async (text: string) => {
      setTranscript(text);
      setShowBubble(true);

      // Try local intent first
      const intentResult = processIntent(text);
      if (intentResult.matched) {
        setStatus("idle");
        return;
      }

      // Fall through to AI
      setStatus("processing");
      await ai.ask(text);
      setStatus("idle");
    },
    [processIntent, ai],
  );

  // Speak AI responses
  useEffect(() => {
    if (ai.response && settings.tts_enabled) {
      tts.speak(ai.response);
    }
  }, [ai.response, settings.tts_enabled, tts]);

  const recognition = useVoiceRecognition({
    language: settings.language,
    onResult: handleVoiceResult,
    onError: (error) => {
      setStatus("error");
      setTranscript(error);
      setShowBubble(true);
      setTimeout(() => setStatus("idle"), 3000);
    },
  });

  const startListening = useCallback(() => {
    tts.stop();
    setStatus("listening");
    setTranscript("");
    ai.clearResponse();
    recognition.start();
  }, [recognition, ai, tts]);

  const stopListening = useCallback(() => {
    recognition.stop();
    setStatus("idle");
  }, [recognition]);

  useWakeWord({
    enabled: settings.voice_enabled && settings.wake_word_enabled,
    language: settings.language,
    onWakeWord: startListening,
  });

  const handleMicClick = useCallback(() => {
    if (status === "listening") {
      stopListening();
    } else if (status === "idle") {
      startListening();
    }
  }, [status, startListening, stopListening]);

  const handleHintClick = useCallback(
    (hint: string) => {
      handleVoiceResult(hint);
    },
    [handleVoiceResult],
  );

  const handleConfirm = useCallback(
    (confirmed: boolean) => {
      ai.confirm(confirmed);
    },
    [ai],
  );

  const hints = useMemo(
    () => getHintsForPage(currentPage, settings.language),
    [currentPage, settings.language],
  );

  const contextValue = useMemo<VoiceContextValue>(
    () => ({
      status,
      transcript,
      aiResponse: ai.response,
      pendingAction: ai.pendingAction,
      settings,
      startListening,
      stopListening,
      confirmAction: handleConfirm,
      updateSettings: handleUpdateSettings,
    }),
    [status, transcript, ai.response, ai.pendingAction, settings, startListening, stopListening, handleConfirm, handleUpdateSettings],
  );

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}

      {settings.voice_enabled && (
        <>
          <HintChips
            hints={hints}
            visible={status === "listening"}
            size={settings.hint_size}
            onHintClick={handleHintClick}
          />
          <SpeechBubble
            transcript={transcript}
            response={ai.response}
            visible={showBubble}
            onClose={() => {
              setShowBubble(false);
              ai.clearResponse();
            }}
          />
          <FloatingMic status={status} onClick={handleMicClick} />
          <ConfirmationDialog action={ai.pendingAction} onConfirm={handleConfirm} />
        </>
      )}
    </VoiceContext.Provider>
  );
}
```

- [ ] **Step 2: Create index.ts exports**

Create `frontend/src/features/voice-assistant/index.ts`:

```typescript
export { VoiceAssistantProvider, useVoiceAssistant } from "./components/VoiceAssistantProvider";
export type { VoiceSettings, VoiceContextValue } from "./types";
```

- [ ] **Step 3: Integrate into portal layout**

In `frontend/src/routes/portal/_portal.tsx`, add the import at the top:

```typescript
import { VoiceAssistantProvider } from "@/features/voice-assistant";
```

Wrap the returned JSX with `<VoiceAssistantProvider>`. Find the outermost `<div>` in the return statement and wrap it:

```tsx
return (
  <VoiceAssistantProvider>
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* ...existing layout content... */}
    </div>
  </VoiceAssistantProvider>
);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/voice-assistant/ frontend/src/routes/portal/_portal.tsx
git commit -m "feat(voice): add VoiceAssistantProvider and integrate into portal layout"
```

---

## Task 12: Frontend — Voice Settings in Profile Page

**Files:**
- Modify: `frontend/src/routes/portal/_portal/profile.tsx`

- [ ] **Step 1: Add voice settings section to profile**

In `frontend/src/routes/portal/_portal/profile.tsx`, add the import:

```typescript
import { useVoiceAssistant } from "@/features/voice-assistant";
```

Inside the component, add after existing code:

```typescript
const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceAssistant();
```

Add a new section in the JSX after the notification preferences section (or at the end of the settings area):

```tsx
{/* Voice Assistant Settings */}
<div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
    <Mic className="h-5 w-5 text-[var(--color-secondary)]" />
    Голосовой ассистент
  </h3>

  <div className="space-y-4">
    {/* Voice enabled */}
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Голосовое управление</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">Плавающая кнопка микрофона</p>
      </div>
      <button
        onClick={() => updateVoiceSettings({ voice_enabled: !voiceSettings.voice_enabled })}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          voiceSettings.voice_enabled ? "bg-[var(--color-secondary)]" : "bg-[var(--color-muted)]"
        }`}
        role="switch"
        aria-checked={voiceSettings.voice_enabled}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            voiceSettings.voice_enabled ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>

    {/* Wake word */}
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Активация голосом</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">"Эй, Медкор"</p>
      </div>
      <button
        onClick={() => updateVoiceSettings({ wake_word_enabled: !voiceSettings.wake_word_enabled })}
        disabled={!voiceSettings.voice_enabled}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          voiceSettings.wake_word_enabled && voiceSettings.voice_enabled
            ? "bg-[var(--color-secondary)]"
            : "bg-[var(--color-muted)]"
        } ${!voiceSettings.voice_enabled ? "opacity-50 cursor-not-allowed" : ""}`}
        role="switch"
        aria-checked={voiceSettings.wake_word_enabled}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            voiceSettings.wake_word_enabled && voiceSettings.voice_enabled ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>

    {/* TTS */}
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Озвучка ответов</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">Text-to-Speech</p>
      </div>
      <button
        onClick={() => updateVoiceSettings({ tts_enabled: !voiceSettings.tts_enabled })}
        disabled={!voiceSettings.voice_enabled}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          voiceSettings.tts_enabled && voiceSettings.voice_enabled
            ? "bg-[var(--color-secondary)]"
            : "bg-[var(--color-muted)]"
        } ${!voiceSettings.voice_enabled ? "opacity-50 cursor-not-allowed" : ""}`}
        role="switch"
        aria-checked={voiceSettings.tts_enabled}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            voiceSettings.tts_enabled && voiceSettings.voice_enabled ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>

    {/* Language */}
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">Язык распознавания</p>
      <select
        value={voiceSettings.language}
        onChange={(e) => updateVoiceSettings({ language: e.target.value as "ru" | "ky" | "en" })}
        disabled={!voiceSettings.voice_enabled}
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] ${
          !voiceSettings.voice_enabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <option value="ru">Русский</option>
        <option value="ky">Кыргызча</option>
        <option value="en">English</option>
      </select>
    </div>

    {/* TTS Speed */}
    {voiceSettings.tts_enabled && voiceSettings.voice_enabled && (
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Скорость озвучки</p>
          <span className="text-xs text-[var(--color-text-tertiary)]">{voiceSettings.tts_speed}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={voiceSettings.tts_speed}
          onChange={(e) => updateVoiceSettings({ tts_speed: parseFloat(e.target.value) })}
          className="w-full accent-[var(--color-secondary)]"
        />
      </div>
    )}

    {/* Hint size */}
    {voiceSettings.voice_enabled && (
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Размер подсказок</p>
        <div className="flex gap-1">
          {(["sm", "md", "lg"] as const).map((size) => (
            <button
              key={size}
              onClick={() => updateVoiceSettings({ hint_size: size })}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                voiceSettings.hint_size === size
                  ? "bg-[var(--color-secondary)] text-white"
                  : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
              }`}
            >
              {size === "sm" ? "S" : size === "md" ? "M" : "L"}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
</div>
```

Add `Mic` to the lucide-react import at the top of the file:

```typescript
import { Mic } from "lucide-react";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/portal/_portal/profile.tsx
git commit -m "feat(voice): add voice settings section to patient profile page"
```

---

## Task 13: Add Web Speech API TypeScript Declarations

**Files:**
- Create: `frontend/src/types/speech-recognition.d.ts`

- [ ] **Step 1: Create type declarations**

Create `frontend/src/types/speech-recognition.d.ts`:

```typescript
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/speech-recognition.d.ts
git commit -m "feat(voice): add Web Speech API TypeScript declarations"
```

---

## Task 14: Environment Variables & Final Wiring

**Files:**
- Modify: `backend/.env` (or `.env.example`)

- [ ] **Step 1: Add environment variables**

Add to `.env`:

```
# Voice Assistant
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
WHISPER_MODEL_SIZE=base
VOICE_AI_TIMEOUT=5
VOICE_RATE_LIMIT=30
```

- [ ] **Step 2: Verify backend starts**

Run:

```bash
cd /Users/azamat/Desktop/telemed-v2-super
docker compose up backend -d
docker compose logs backend --tail=20
```

Expected: Backend starts without import errors. Voice routes registered.

- [ ] **Step 3: Verify frontend compiles**

Run:

```bash
cd /Users/azamat/Desktop/telemed-v2-super/frontend
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat(voice): add voice assistant environment variables"
```

---

## Task 15: Smoke Test & Cleanup

- [ ] **Step 1: Test voice endpoint manually**

```bash
curl -X POST http://localhost/api/v1/portal/voice/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "когда мой следующий приём", "language": "ru", "page": "dashboard"}'
```

Expected: JSON response with `type: "answer"` or `type: "error"` (if no API keys set).

- [ ] **Step 2: Test hints endpoint**

```bash
curl http://localhost/api/v1/portal/voice/hints/dashboard?lang=ru \
  -H "Authorization: Bearer <token>"
```

Expected: `{"hints": ["Расписание", "Мои анализы", "Ближайший приём"]}`

- [ ] **Step 3: Test frontend renders**

Open browser at `http://localhost:5173/portal/profile`, enable voice settings. Verify:
- FloatingMic button appears in bottom-right corner
- Clicking mic activates listening state (pulsing animation)
- HintChips appear above mic button
- Profile page shows voice settings section

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(voice): voice assistant module complete - navigation, AI dialogue, settings"
```
