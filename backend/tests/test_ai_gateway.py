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


from app.services.ai.prompt_manager import PromptManager
from app.services.ai.response_parser import ResponseParser


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
