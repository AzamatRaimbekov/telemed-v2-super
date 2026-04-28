import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ai.providers.base import BaseProvider, ProviderResponse
from app.services.ai.providers.gemini import GeminiProvider
from app.services.ai.providers.groq import GroqProvider
from app.services.ai.providers.deepseek import DeepSeekProvider
from app.services.ai.providers.openrouter import OpenRouterProvider
from app.services.ai.providers.huggingface import HuggingFaceProvider
from app.services.ai.providers.cloudflare import CloudflareProvider


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


# ---------------------------------------------------------------------------
# Groq
# ---------------------------------------------------------------------------

def test_groq_provider_init():
    provider = GroqProvider(api_key="groq-key")
    assert provider.name == "groq"
    assert provider.api_key == "groq-key"


@pytest.mark.asyncio
async def test_groq_provider_complete_success():
    provider = GroqProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "result text"}}],
        "usage": {"prompt_tokens": 30, "completion_tokens": 10},
        "model": "llama-3.3-70b-versatile",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == "result text"
    assert result.provider == "groq"
    assert result.input_tokens == 30
    assert result.output_tokens == 10


# ---------------------------------------------------------------------------
# DeepSeek
# ---------------------------------------------------------------------------

def test_deepseek_provider_init():
    provider = DeepSeekProvider(api_key="ds-key")
    assert provider.name == "deepseek"
    assert provider.api_key == "ds-key"


@pytest.mark.asyncio
async def test_deepseek_provider_complete_success():
    provider = DeepSeekProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "deepseek result"}}],
        "usage": {"prompt_tokens": 25, "completion_tokens": 15},
        "model": "deepseek-chat",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == "deepseek result"
    assert result.provider == "deepseek"
    assert result.input_tokens == 25
    assert result.output_tokens == 15


# ---------------------------------------------------------------------------
# OpenRouter
# ---------------------------------------------------------------------------

def test_openrouter_provider_init():
    provider = OpenRouterProvider(api_key="or-key")
    assert provider.name == "openrouter"
    assert provider.api_key == "or-key"


@pytest.mark.asyncio
async def test_openrouter_provider_complete_success():
    provider = OpenRouterProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "openrouter result"}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 10},
        "model": "meta-llama/llama-3.3-70b-instruct:free",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == "openrouter result"
    assert result.provider == "openrouter"
    assert result.input_tokens == 20
    assert result.output_tokens == 10


# ---------------------------------------------------------------------------
# HuggingFace
# ---------------------------------------------------------------------------

def test_huggingface_provider_init():
    provider = HuggingFaceProvider(api_key="hf-key")
    assert provider.name == "huggingface"
    assert provider.api_key == "hf-key"


@pytest.mark.asyncio
async def test_huggingface_provider_complete_success():
    provider = HuggingFaceProvider(api_key="fake-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"generated_text": "hf result"}]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == "hf result"
    assert result.provider == "huggingface"
    assert result.input_tokens > 0
    assert result.output_tokens > 0


# ---------------------------------------------------------------------------
# Cloudflare
# ---------------------------------------------------------------------------

def test_cloudflare_provider_init():
    provider = CloudflareProvider(api_key="cf-key", account_id="acct-123")
    assert provider.name == "cloudflare"
    assert provider.api_key == "cf-key"
    assert provider.account_id == "acct-123"


@pytest.mark.asyncio
async def test_cloudflare_provider_complete_success():
    provider = CloudflareProvider(api_key="fake-key", account_id="acct-123")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"result": {"response": "cf result"}, "success": True}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete(
            system_prompt="You are a doctor.",
            user_prompt="Suggest diagnoses.",
        )

    assert result.text == "cf result"
    assert result.provider == "cloudflare"
    assert result.input_tokens == 0
    assert result.output_tokens == 0
