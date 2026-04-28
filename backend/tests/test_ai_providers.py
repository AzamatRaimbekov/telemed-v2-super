import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ai.providers.base import BaseProvider, ProviderResponse
from app.services.ai.providers.gemini import GeminiProvider


def test_provider_response_dataclass():
    resp = ProviderResponse(
        text="Hello",
        model="gemini-2.0-flash",
        provider="gemini",
        input_tokens=10,
        output_tokens=5,
        latency_ms=100,
    )
    assert resp.text == "Hello"
    assert resp.model == "gemini-2.0-flash"
    assert resp.provider == "gemini"


def test_base_provider_is_abstract():
    with pytest.raises(TypeError):
        BaseProvider(api_key="test")


def test_gemini_provider_init():
    provider = GeminiProvider(api_key="test-key")
    assert provider.name == "gemini"
    assert provider.api_key == "test-key"


@pytest.mark.asyncio
async def test_gemini_provider_complete_success():
    provider = GeminiProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": '{"diagnoses": ["J06.9"]}'}]
                }
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 50,
            "candidatesTokenCount": 20,
        },
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == '{"diagnoses": ["J06.9"]}'
    assert result.provider == "gemini"
    assert result.input_tokens == 50
    assert result.output_tokens == 20


@pytest.mark.asyncio
async def test_gemini_provider_complete_failure():
    provider = GeminiProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = "Rate limited"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        with pytest.raises(Exception, match="Gemini API error 429"):
            await provider.complete(
                system_prompt="You are a doctor.",
                user_prompt="Suggest diagnoses.",
            )
