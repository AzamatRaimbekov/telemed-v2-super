from __future__ import annotations
import logging
from app.core.config import settings
from app.services.ai.router import ProviderRouter
from app.services.ai.prompt_manager import PromptManager
from app.services.ai.response_parser import ResponseParser
from app.services.ai.providers.gemini import GeminiProvider
from app.services.ai.providers.groq import GroqProvider
from app.services.ai.providers.deepseek import DeepSeekProvider
from app.services.ai.providers.openrouter import OpenRouterProvider
from app.services.ai.providers.huggingface import HuggingFaceProvider
from app.services.ai.providers.cloudflare import CloudflareProvider

logger = logging.getLogger(__name__)

TASK_MODEL_MAP = {
    "diagnosis":   {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter", "groq"]},
    "summary":     {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
    "exam":        {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter"]},
    "conclusion":  {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
    "ocr":         {"tier": "powerful", "providers": ["gemini", "openrouter"]},
    "treatment":   {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter"]},
    "lab_suggest": {"tier": "fast",     "providers": ["groq", "deepseek", "cloudflare"]},
    "predict":     {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
}

PROMPTS = {
    "diagnosis": {
        "system": (
            "Ты — опытный врач-терапевт. Проанализируй симптомы пациента и предложи до 5 наиболее вероятных диагнозов. "
            "Для каждого укажи код МКБ-10, название на русском, уверенность (0-1) и краткое обоснование. "
            "Ответь строго в JSON: {\"suggestions\": [{\"icd_code\": \"...\", \"title\": \"...\", \"confidence\": 0.0, \"reasoning\": \"...\"}]}"
        ),
        "user": "Симптомы: {symptoms}\nВозраст: {age}\nПол: {sex}\nСуществующие диагнозы: {existing_diagnoses}",
    },
    "exam": {
        "system": (
            "Ты — опытный врач. На основании жалоб пациента сгенерируй структурированный текст осмотра. "
            "Включи: общее состояние, осмотр по системам, предварительное заключение. "
            "Ответь строго в JSON: {\"examination_text\": \"...\"}"
        ),
        "user": "Жалобы: {complaints}\nТип визита: {visit_type}",
    },
    "summary": {
        "system": (
            "Ты — врач, составляющий краткое резюме истории болезни пациента для нового врача. "
            "Включи: ключевые диагнозы, текущие лекарства, факторы риска. "
            "Ответь строго в JSON: {\"summary\": \"...\", \"key_diagnoses\": [...], \"key_medications\": [...], \"risk_factors\": [...]}"
        ),
        "user": "История болезни:\n{history_text}",
    },
    "conclusion": {
        "system": (
            "Ты — врач, формирующий медицинское заключение по результатам осмотра. "
            "Включи: основной диагноз, сопутствующие, рекомендации. Стиль — официальный медицинский. "
            "Ответь строго в JSON: {\"conclusion_text\": \"...\"}"
        ),
        "user": "Диагнозы: {diagnoses}\nОсмотр: {exam_notes}\nЛечение: {treatment}",
    },
}


class AIGateway:
    def __init__(self) -> None:
        timeout = settings.AI_REQUEST_TIMEOUT if hasattr(settings, "AI_REQUEST_TIMEOUT") else 30
        providers: dict = {}

        if settings.GEMINI_API_KEY:
            providers["gemini"] = GeminiProvider(api_key=settings.GEMINI_API_KEY, timeout=timeout)
        if settings.GROQ_API_KEY:
            providers["groq"] = GroqProvider(api_key=settings.GROQ_API_KEY, timeout=timeout)
        if settings.DEEPSEEK_API_KEY:
            providers["deepseek"] = DeepSeekProvider(api_key=settings.DEEPSEEK_API_KEY, timeout=timeout)
        if hasattr(settings, "OPENROUTER_API_KEY") and settings.OPENROUTER_API_KEY:
            providers["openrouter"] = OpenRouterProvider(api_key=settings.OPENROUTER_API_KEY, timeout=timeout)
        if hasattr(settings, "HF_API_TOKEN") and settings.HF_API_TOKEN:
            providers["huggingface"] = HuggingFaceProvider(api_key=settings.HF_API_TOKEN, timeout=timeout)
        if hasattr(settings, "CF_API_TOKEN") and settings.CF_API_TOKEN:
            cf_account = settings.CF_ACCOUNT_ID if hasattr(settings, "CF_ACCOUNT_ID") else ""
            providers["cloudflare"] = CloudflareProvider(api_key=settings.CF_API_TOKEN, account_id=cf_account, timeout=timeout)

        self.providers = providers
        self.router = ProviderRouter(providers=providers, task_model_map=TASK_MODEL_MAP)
        self.prompt_manager = PromptManager()
        self.parser = ResponseParser()

    async def suggest_diagnoses(
        self,
        symptoms: str,
        age: int | None = None,
        sex: str | None = None,
        existing_diagnoses: list[str] | None = None,
    ) -> dict:
        prompts = PROMPTS["diagnosis"]
        user_prompt = self.prompt_manager.render(
            prompts["user"],
            symptoms=symptoms,
            age=str(age or "не указан"),
            sex=sex or "не указан",
            existing_diagnoses=", ".join(existing_diagnoses) if existing_diagnoses else "нет",
        )
        response = await self.router.complete("diagnosis", prompts["system"], user_prompt)
        parsed = self.parser.extract_json(response.text)
        if parsed and "suggestions" in parsed:
            return {**parsed, "provider": response.provider, "model": response.model}
        return {"suggestions": [], "raw_text": response.text, "provider": response.provider, "model": response.model}

    async def generate_exam(
        self,
        complaints: str,
        visit_type: str = "CONSULTATION",
    ) -> dict:
        prompts = PROMPTS["exam"]
        user_prompt = self.prompt_manager.render(
            prompts["user"],
            complaints=complaints,
            visit_type=visit_type,
        )
        response = await self.router.complete("exam", prompts["system"], user_prompt)
        parsed = self.parser.extract_json(response.text)
        if parsed and "examination_text" in parsed:
            return {**parsed, "provider": response.provider, "model": response.model}
        return {"examination_text": response.text, "provider": response.provider, "model": response.model}

    async def summarize_patient(self, history_text: str) -> dict:
        prompts = PROMPTS["summary"]
        user_prompt = self.prompt_manager.render(prompts["user"], history_text=history_text)
        response = await self.router.complete("summary", prompts["system"], user_prompt)
        parsed = self.parser.extract_json(response.text)
        if parsed and "summary" in parsed:
            return {**parsed, "provider": response.provider, "model": response.model}
        return {
            "summary": response.text,
            "key_diagnoses": [],
            "key_medications": [],
            "risk_factors": [],
            "provider": response.provider,
            "model": response.model,
        }

    async def generate_conclusion(
        self,
        diagnoses: list[str],
        exam_notes: str | None = None,
        treatment: str | None = None,
    ) -> dict:
        prompts = PROMPTS["conclusion"]
        user_prompt = self.prompt_manager.render(
            prompts["user"],
            diagnoses=", ".join(diagnoses),
            exam_notes=exam_notes or "не указан",
            treatment=treatment or "не назначено",
        )
        response = await self.router.complete("conclusion", prompts["system"], user_prompt)
        parsed = self.parser.extract_json(response.text)
        if parsed and "conclusion_text" in parsed:
            return {**parsed, "provider": response.provider, "model": response.model}
        return {"conclusion_text": response.text, "provider": response.provider, "model": response.model}
