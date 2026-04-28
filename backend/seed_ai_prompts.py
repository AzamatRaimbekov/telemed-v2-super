"""Seed default AI prompt templates into the database."""
import asyncio
import uuid
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.ai import AIPromptTemplate, ModelTier

TEMPLATES = [
    {
        "task_type": "diagnosis",
        "model_tier": ModelTier.POWERFUL,
        "system_prompt": (
            "Ты — опытный врач-терапевт. Проанализируй симптомы пациента и предложи до 5 наиболее вероятных диагнозов. "
            "Для каждого укажи код МКБ-10, название на русском, уверенность (0-1) и краткое обоснование. "
            'Ответь строго в JSON: {"suggestions": [{"icd_code": "...", "title": "...", "confidence": 0.0, "reasoning": "..."}]}'
        ),
        "user_prompt_template": "Симптомы: {symptoms}\nВозраст: {age}\nПол: {sex}\nСуществующие диагнозы: {existing_diagnoses}",
    },
    {
        "task_type": "exam",
        "model_tier": ModelTier.POWERFUL,
        "system_prompt": (
            "Ты — опытный врач. На основании жалоб пациента сгенерируй структурированный текст осмотра. "
            "Включи: общее состояние, осмотр по системам, предварительное заключение. "
            'Ответь строго в JSON: {"examination_text": "..."}'
        ),
        "user_prompt_template": "Жалобы: {complaints}\nТип визита: {visit_type}",
    },
    {
        "task_type": "summary",
        "model_tier": ModelTier.FAST,
        "system_prompt": (
            "Ты — врач, составляющий краткое резюме истории болезни пациента для нового врача. "
            "Включи: ключевые диагнозы, текущие лекарства, факторы риска. "
            'Ответь строго в JSON: {"summary": "...", "key_diagnoses": [...], "key_medications": [...], "risk_factors": [...]}'
        ),
        "user_prompt_template": "История болезни:\n{history_text}",
    },
    {
        "task_type": "conclusion",
        "model_tier": ModelTier.FAST,
        "system_prompt": (
            "Ты — врач, формирующий медицинское заключение по результатам осмотра. "
            "Включи: основной диагноз, сопутствующие, рекомендации. Стиль — официальный медицинский. "
            'Ответь строго в JSON: {"conclusion_text": "..."}'
        ),
        "user_prompt_template": "Диагнозы: {diagnoses}\nОсмотр: {exam_notes}\nЛечение: {treatment}",
    },
    {
        "task_type": "treatment",
        "model_tier": ModelTier.POWERFUL,
        "system_prompt": (
            "Ты — опытный врач. Предложи план лечения по диагнозу. "
            "Включи: медикаменты с дозировками, процедуры, рекомендации. "
            'Ответь строго в JSON: {"plan": "...", "medications": [...], "procedures": [...]}'
        ),
        "user_prompt_template": "Диагноз: {diagnosis_code} {diagnosis_title}",
    },
    {
        "task_type": "lab_suggest",
        "model_tier": ModelTier.FAST,
        "system_prompt": (
            "Ты — опытный врач. Предложи набор лабораторных анализов для подтверждения/мониторинга диагноза. "
            "Укажи список анализов и обоснование. "
            'Ответь строго в JSON: {"suggested_tests": [...], "reasoning": "..."}'
        ),
        "user_prompt_template": "Диагноз: {diagnosis_code} {diagnosis_title}",
    },
]


async def seed():
    async with async_session_factory() as session:
        for tmpl in TEMPLATES:
            existing = await session.execute(
                select(AIPromptTemplate).where(
                    AIPromptTemplate.task_type == tmpl["task_type"],
                    AIPromptTemplate.is_active == True,
                    AIPromptTemplate.is_deleted == False,
                )
            )
            if existing.scalar_one_or_none():
                print(f"  Skip {tmpl['task_type']} (already exists)")
                continue
            obj = AIPromptTemplate(
                id=uuid.uuid4(),
                task_type=tmpl["task_type"],
                system_prompt=tmpl["system_prompt"],
                user_prompt_template=tmpl["user_prompt_template"],
                model_tier=tmpl["model_tier"],
                version=1,
                is_active=True,
            )
            session.add(obj)
            print(f"  Added {tmpl['task_type']}")
        await session.commit()
    print("AI prompt seeding done.")


if __name__ == "__main__":
    asyncio.run(seed())
