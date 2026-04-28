import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.ai.router import ProviderRouter
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class FakeProvider(BaseProvider):
    name = "fake"

    async def complete(self, system_prompt, user_prompt, **kwargs):
        return ProviderResponse(
            text="fake response",
            model="fake-model",
            provider="fake",
            input_tokens=10,
            output_tokens=5,
            latency_ms=50,
        )


class FailingProvider(BaseProvider):
    name = "failing"

    async def complete(self, system_prompt, user_prompt, **kwargs):
        raise Exception("Provider down")


TASK_MODEL_MAP = {
    "diagnosis": {"tier": "powerful", "providers": ["failing", "fake"]},
    "summary": {"tier": "fast", "providers": ["fake"]},
}


def test_router_init():
    providers = {"fake": FakeProvider(api_key="k")}
    router = ProviderRouter(providers=providers, task_model_map=TASK_MODEL_MAP)
    assert router is not None


@pytest.mark.asyncio
async def test_router_selects_first_available():
    providers = {"fake": FakeProvider(api_key="k")}
    router = ProviderRouter(providers=providers, task_model_map=TASK_MODEL_MAP)
    result = await router.complete("summary", "system", "user")
    assert result.provider == "fake"
    assert result.text == "fake response"


@pytest.mark.asyncio
async def test_router_falls_back_on_failure():
    providers = {
        "failing": FailingProvider(api_key="k"),
        "fake": FakeProvider(api_key="k"),
    }
    router = ProviderRouter(providers=providers, task_model_map=TASK_MODEL_MAP)
    result = await router.complete("diagnosis", "system", "user")
    assert result.provider == "fake"


@pytest.mark.asyncio
async def test_router_all_providers_fail():
    providers = {"failing": FailingProvider(api_key="k")}
    task_map = {"diagnosis": {"tier": "powerful", "providers": ["failing"]}}
    router = ProviderRouter(providers=providers, task_model_map=task_map)
    with pytest.raises(Exception, match="All AI providers failed"):
        await router.complete("diagnosis", "system", "user")


@pytest.mark.asyncio
async def test_router_unknown_task_uses_default():
    providers = {"fake": FakeProvider(api_key="k")}
    router = ProviderRouter(providers=providers, task_model_map=TASK_MODEL_MAP)
    result = await router.complete("unknown_task", "system", "user")
    assert result.provider == "fake"


from unittest.mock import patch, AsyncMock
from app.services.ai.prompt_manager import PromptManager
from app.services.ai.response_parser import ResponseParser
from app.services.ai.gateway import AIGateway


# --- PromptManager ---

def test_prompt_manager_render():
    pm = PromptManager()
    template = "Пациент: {patient_name}, жалобы: {complaints}"
    result = pm.render(template, patient_name="Иванов", complaints="головная боль")
    assert result == "Пациент: Иванов, жалобы: головная боль"


def test_prompt_manager_render_missing_var():
    pm = PromptManager()
    template = "Пациент: {patient_name}, возраст: {age}"
    result = pm.render(template, patient_name="Иванов")
    assert "Иванов" in result
    assert "{age}" in result  # missing vars stay as-is


# --- ResponseParser ---

def test_response_parser_extract_json():
    parser = ResponseParser()
    text = 'Some text before ```json\n{"diagnoses": ["J06.9"]}\n``` and after'
    result = parser.extract_json(text)
    assert result == {"diagnoses": ["J06.9"]}


def test_response_parser_extract_json_no_fence():
    parser = ResponseParser()
    text = '{"diagnoses": ["J06.9"]}'
    result = parser.extract_json(text)
    assert result == {"diagnoses": ["J06.9"]}


def test_response_parser_extract_json_invalid():
    parser = ResponseParser()
    text = "This is not JSON at all"
    result = parser.extract_json(text)
    assert result is None


def test_response_parser_extract_json_nested_in_text():
    parser = ResponseParser()
    text = 'Вот мой ответ:\n{"suggestions": [{"icd_code": "J06.9", "title": "ОРВИ"}]}\nСпасибо!'
    result = parser.extract_json(text)
    assert result["suggestions"][0]["icd_code"] == "J06.9"


@pytest.mark.asyncio
async def test_gateway_diagnose():
    gateway = AIGateway()
    mock_response = ProviderResponse(
        text='{"suggestions": [{"icd_code": "J06.9", "title": "ОРВИ", "confidence": 0.85, "reasoning": "По симптомам"}]}',
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=50,
        output_tokens=30,
        latency_ms=200,
    )
    with patch.object(gateway.router, "complete", new_callable=AsyncMock, return_value=mock_response):
        result = await gateway.suggest_diagnoses(
            symptoms="головная боль, температура 38",
            age=35,
            sex="M",
        )
    assert len(result["suggestions"]) == 1
    assert result["suggestions"][0]["icd_code"] == "J06.9"
    assert result["provider"] == "gemini"
    assert result["model"] == "gemini-2.0-flash"


@pytest.mark.asyncio
async def test_gateway_generate_exam():
    gateway = AIGateway()
    mock_response = ProviderResponse(
        text='{"examination_text": "Общее состояние удовлетворительное. Кожные покровы обычной окраски."}',
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=40,
        output_tokens=25,
        latency_ms=150,
    )
    with patch.object(gateway.router, "complete", new_callable=AsyncMock, return_value=mock_response):
        result = await gateway.generate_exam(complaints="боль в горле, насморк")
    assert "examination_text" in result
    assert result["provider"] == "gemini"


@pytest.mark.asyncio
async def test_gateway_summarize_patient():
    gateway = AIGateway()
    mock_response = ProviderResponse(
        text='{"summary": "Пациент 35 лет, хронический гастрит.", "key_diagnoses": ["K29.5"], "key_medications": ["Омепразол"], "risk_factors": ["Курение"]}',
        model="llama-3.3-70b-versatile",
        provider="groq",
        input_tokens=100,
        output_tokens=40,
        latency_ms=300,
    )
    with patch.object(gateway.router, "complete", new_callable=AsyncMock, return_value=mock_response):
        result = await gateway.summarize_patient(history_text="Хронический гастрит с 2020 г.")
    assert "summary" in result
    assert result["provider"] == "groq"


@pytest.mark.asyncio
async def test_gateway_generate_conclusion():
    gateway = AIGateway()
    mock_response = ProviderResponse(
        text='{"conclusion_text": "Заключение: ОРВИ, лёгкое течение. Рекомендовано: постельный режим."}',
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=60,
        output_tokens=30,
        latency_ms=180,
    )
    with patch.object(gateway.router, "complete", new_callable=AsyncMock, return_value=mock_response):
        result = await gateway.generate_conclusion(
            diagnoses=["J06.9 ОРВИ"],
            exam_notes="Температура 37.5",
            treatment="Парацетамол",
        )
    assert "conclusion_text" in result
    assert result["provider"] == "gemini"


@pytest.mark.asyncio
async def test_full_flow_diagnosis_to_conclusion():
    """Integration test: diagnose -> exam -> conclusion pipeline."""
    gateway = AIGateway()

    # Step 1: Diagnose
    diagnosis_response = ProviderResponse(
        text='{"suggestions": [{"icd_code": "J06.9", "title": "ОРВИ", "confidence": 0.9, "reasoning": "Типичные симптомы"}]}',
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=50,
        output_tokens=30,
        latency_ms=200,
    )

    # Step 2: Exam
    exam_response = ProviderResponse(
        text='{"examination_text": "Общее состояние удовлетворительное. Ротоглотка гиперемирована."}',
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=40,
        output_tokens=25,
        latency_ms=180,
    )

    # Step 3: Conclusion
    conclusion_response = ProviderResponse(
        text='{"conclusion_text": "Заключение: ОРВИ (J06.9), лёгкое течение. Рекомендовано: обильное питьё, парацетамол при T>38.5."}',
        model="groq-llama",
        provider="groq",
        input_tokens=60,
        output_tokens=35,
        latency_ms=150,
    )

    with patch.object(gateway.router, "complete", new_callable=AsyncMock) as mock_complete:
        mock_complete.side_effect = [diagnosis_response, exam_response, conclusion_response]

        diag = await gateway.suggest_diagnoses(symptoms="боль в горле, температура 38.2, насморк")
        assert diag["suggestions"][0]["icd_code"] == "J06.9"

        exam = await gateway.generate_exam(complaints="боль в горле, температура 38.2")
        assert "Ротоглотка" in exam["examination_text"]

        conclusion = await gateway.generate_conclusion(
            diagnoses=["J06.9 ОРВИ"],
            exam_notes=exam["examination_text"],
            treatment="Парацетамол 500мг при T>38.5",
        )
        assert "ОРВИ" in conclusion["conclusion_text"]
