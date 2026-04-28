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
