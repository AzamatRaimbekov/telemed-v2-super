# AI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified AI Gateway with multi-provider fallback for doctor-facing AI features (diagnosis suggestion, exam auto-fill, patient summary, conclusion generation).

**Architecture:** Single `AIGateway` service orchestrates `ProviderRouter` (model selection + fallback), `PromptManager` (template loading), and `ResponseParser` (JSON extraction). Six provider adapters (Gemini, Groq, DeepSeek, OpenRouter, HuggingFace, Cloudflare) implement a common `BaseProvider` interface. All calls logged for audit.

**Tech Stack:** FastAPI, SQLAlchemy (async), httpx, Pydantic v2, pytest, alembic. Free-tier LLM APIs only.

**Spec:** `docs/superpowers/specs/2026-04-27-ai-gateway-design.md`

---

## File Structure

```
backend/app/
  models/ai.py                          -- 4 SQLAlchemy tables
  schemas/ai.py                         -- Pydantic request/response schemas
  services/ai/
    __init__.py                         -- re-exports AIGateway
    gateway.py                          -- AIGateway main orchestrator
    router.py                           -- ProviderRouter (selection + fallback)
    prompt_manager.py                   -- load & render prompt templates
    response_parser.py                  -- extract JSON from LLM text
    providers/
      __init__.py                       -- re-exports all providers
      base.py                           -- BaseProvider ABC
      gemini.py                         -- Google Gemini free API
      groq.py                           -- Groq free API
      deepseek.py                       -- DeepSeek free API
      openrouter.py                     -- OpenRouter free models
      huggingface.py                    -- HF Inference API
      cloudflare.py                     -- Cloudflare Workers AI
  api/v1/routes/ai.py                  -- extend existing (add new endpoints)
backend/tests/
  test_ai_gateway.py                   -- gateway + router tests
  test_ai_providers.py                 -- provider unit tests
  test_ai_routes.py                    -- API endpoint tests
backend/alembic/versions/xxxx_add_ai_tables.py -- migration
backend/seed_ai_prompts.py            -- seed default prompt templates
```

---

### Task 1: Configuration and SQLAlchemy Models

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/models/ai.py`

- [ ] **Step 1: Add AI provider env vars to Settings**

In `backend/app/core/config.py`, add these fields after the existing `DEEPSEEK_API_KEY` line (around line 38):

```python
    # AI Gateway providers
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    HF_API_TOKEN: str = ""
    CF_ACCOUNT_ID: str = ""
    CF_API_TOKEN: str = ""
    AI_REQUEST_TIMEOUT: int = 30  # seconds
```

- [ ] **Step 2: Create SQLAlchemy models for AI tables**

Create `backend/app/models/ai.py`:

```python
from __future__ import annotations
import enum
import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, BaseMixin, TenantMixin


class ModelTier(str, enum.Enum):
    FAST = "fast"
    POWERFUL = "powerful"


class AIProvider(BaseMixin, Base):
    __tablename__ = "ai_providers"
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_env: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=10)
    rate_limit: Mapped[int] = mapped_column(Integer, default=1000)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AIPromptTemplate(BaseMixin, Base):
    __tablename__ = "ai_prompt_templates"
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    user_prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    model_tier: Mapped[ModelTier] = mapped_column(
        Enum(ModelTier, values_callable=lambda e: [x.value for x in e]),
        default=ModelTier.FAST,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AIUsageLog(TenantMixin, Base):
    __tablename__ = "ai_usage_log"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider_used: Mapped[str] = mapped_column(String(50), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)


class AIGeneratedContent(TenantMixin, Base):
    __tablename__ = "ai_generated_content"
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    output_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    accepted_by_doctor: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
```

- [ ] **Step 3: Generate alembic migration**

Run:
```bash
cd backend && python -m alembic revision --autogenerate -m "add AI gateway tables"
```

Expected: New migration file in `backend/alembic/versions/`

- [ ] **Step 4: Apply migration**

Run:
```bash
cd backend && python -m alembic upgrade head
```

Expected: 4 new tables created (ai_providers, ai_prompt_templates, ai_usage_log, ai_generated_content)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/models/ai.py backend/alembic/versions/
git commit -m "feat(ai): add AI gateway config and SQLAlchemy models (4 tables)"
```

---

### Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/ai.py`

- [ ] **Step 1: Create all AI request/response schemas**

Create `backend/app/schemas/ai.py`:

```python
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# --- Requests ---

class DiagnosisSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    symptoms: str = Field(..., min_length=3, max_length=5000)
    age: int | None = None
    sex: str | None = None
    existing_diagnoses: list[str] = Field(default_factory=list)


class ExamGenerateRequest(BaseModel):
    patient_id: uuid.UUID
    complaints: str = Field(..., min_length=3, max_length=5000)
    visit_type: str = "CONSULTATION"


class PatientSummaryRequest(BaseModel):
    patient_id: uuid.UUID


class ConclusionGenerateRequest(BaseModel):
    patient_id: uuid.UUID
    visit_id: uuid.UUID | None = None
    diagnoses: list[str] = Field(default_factory=list)
    exam_notes: str | None = None
    treatment: str | None = None


class OCRDocumentRequest(BaseModel):
    patient_id: uuid.UUID


class TreatmentSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str
    diagnosis_title: str


class LabOrderSuggestRequest(BaseModel):
    patient_id: uuid.UUID
    diagnosis_code: str
    diagnosis_title: str


# --- Responses ---

class SuggestedDiagnosis(BaseModel):
    icd_code: str
    title: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class DiagnosisSuggestResponse(BaseModel):
    suggestions: list[SuggestedDiagnosis]
    model_used: str
    provider: str


class ExamGenerateResponse(BaseModel):
    examination_text: str
    model_used: str
    provider: str


class PatientSummaryResponse(BaseModel):
    summary: str
    key_diagnoses: list[str]
    key_medications: list[str]
    risk_factors: list[str]
    model_used: str
    provider: str


class ConclusionGenerateResponse(BaseModel):
    conclusion_text: str
    model_used: str
    provider: str


class TreatmentSuggestResponse(BaseModel):
    plan: str
    medications: list[str]
    procedures: list[str]
    model_used: str
    provider: str


class LabOrderSuggestResponse(BaseModel):
    suggested_tests: list[str]
    reasoning: str
    model_used: str
    provider: str


class AIUsageStats(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    tokens_used: int
    by_provider: dict[str, int]
    by_task_type: dict[str, int]


class PromptTemplateRead(BaseModel):
    id: uuid.UUID
    task_type: str
    system_prompt: str
    user_prompt_template: str
    model_tier: str
    version: int
    is_active: bool
    created_at: datetime


class PromptTemplateUpdate(BaseModel):
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_tier: str | None = None
    is_active: bool | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/ai.py
git commit -m "feat(ai): add Pydantic schemas for AI gateway requests/responses"
```

---

### Task 3: BaseProvider and Gemini Provider

**Files:**
- Create: `backend/app/services/ai/__init__.py`
- Create: `backend/app/services/ai/providers/__init__.py`
- Create: `backend/app/services/ai/providers/base.py`
- Create: `backend/app/services/ai/providers/gemini.py`
- Create: `backend/tests/test_ai_providers.py`

- [ ] **Step 1: Create directory structure and __init__ files**

Run:
```bash
mkdir -p backend/app/services/ai/providers
touch backend/app/services/ai/__init__.py
touch backend/app/services/ai/providers/__init__.py
```

- [ ] **Step 2: Write the failing test for BaseProvider and GeminiProvider**

Create `backend/tests/test_ai_providers.py`:

```python
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
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
cd backend && python -m pytest tests/test_ai_providers.py -v
```

Expected: FAIL — modules not found

- [ ] **Step 4: Implement BaseProvider**

Create `backend/app/services/ai/providers/base.py`:

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderResponse:
    text: str
    model: str
    provider: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


class BaseProvider(ABC):
    name: str = "base"

    def __init__(self, api_key: str, timeout: int = 30) -> None:
        self.api_key = api_key
        self.timeout = timeout

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        ...
```

- [ ] **Step 5: Implement GeminiProvider**

Create `backend/app/services/ai/providers/gemini.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class GeminiProvider(BaseProvider):
    name = "gemini"
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
    DEFAULT_MODEL = "gemini-2.0-flash"

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        url = f"{self.BASE_URL}/{model}:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "text/plain",
            },
        }
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"Gemini API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {})
        return ProviderResponse(
            text=text,
            model=model,
            provider=self.name,
            input_tokens=usage.get("promptTokenCount", 0),
            output_tokens=usage.get("candidatesTokenCount", 0),
            latency_ms=latency,
        )
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
cd backend && python -m pytest tests/test_ai_providers.py -v
```

Expected: 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/ai/ backend/tests/test_ai_providers.py
git commit -m "feat(ai): add BaseProvider ABC and GeminiProvider with tests"
```

---

### Task 4: Remaining Providers (Groq, DeepSeek, OpenRouter, HuggingFace, Cloudflare)

**Files:**
- Create: `backend/app/services/ai/providers/groq.py`
- Create: `backend/app/services/ai/providers/deepseek.py`
- Create: `backend/app/services/ai/providers/openrouter.py`
- Create: `backend/app/services/ai/providers/huggingface.py`
- Create: `backend/app/services/ai/providers/cloudflare.py`
- Modify: `backend/tests/test_ai_providers.py`

- [ ] **Step 1: Add tests for all providers**

Append to `backend/tests/test_ai_providers.py`:

```python
from app.services.ai.providers.groq import GroqProvider
from app.services.ai.providers.deepseek import DeepSeekProvider
from app.services.ai.providers.openrouter import OpenRouterProvider
from app.services.ai.providers.huggingface import HuggingFaceProvider
from app.services.ai.providers.cloudflare import CloudflareProvider


# --- Groq ---
def test_groq_provider_init():
    provider = GroqProvider(api_key="test")
    assert provider.name == "groq"


@pytest.mark.asyncio
async def test_groq_complete_success():
    provider = GroqProvider(api_key="fake")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "result text"}}],
        "usage": {"prompt_tokens": 30, "completion_tokens": 10},
        "model": "llama-3.3-70b-versatile",
    }
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete("system", "user")
    assert result.text == "result text"
    assert result.provider == "groq"


# --- DeepSeek ---
def test_deepseek_provider_init():
    provider = DeepSeekProvider(api_key="test")
    assert provider.name == "deepseek"


@pytest.mark.asyncio
async def test_deepseek_complete_success():
    provider = DeepSeekProvider(api_key="fake")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "deepseek result"}}],
        "usage": {"prompt_tokens": 25, "completion_tokens": 15},
        "model": "deepseek-chat",
    }
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete("system", "user")
    assert result.text == "deepseek result"
    assert result.provider == "deepseek"


# --- OpenRouter ---
def test_openrouter_provider_init():
    provider = OpenRouterProvider(api_key="test")
    assert provider.name == "openrouter"


@pytest.mark.asyncio
async def test_openrouter_complete_success():
    provider = OpenRouterProvider(api_key="fake")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "openrouter result"}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 10},
        "model": "meta-llama/llama-3.3-70b-instruct:free",
    }
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete("system", "user")
    assert result.text == "openrouter result"
    assert result.provider == "openrouter"


# --- HuggingFace ---
def test_huggingface_provider_init():
    provider = HuggingFaceProvider(api_key="test")
    assert provider.name == "huggingface"


@pytest.mark.asyncio
async def test_huggingface_complete_success():
    provider = HuggingFaceProvider(api_key="fake")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"generated_text": "hf result"}]
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete("system", "user")
    assert result.text == "hf result"
    assert result.provider == "huggingface"


# --- Cloudflare ---
def test_cloudflare_provider_init():
    provider = CloudflareProvider(api_key="test", account_id="acc123")
    assert provider.name == "cloudflare"


@pytest.mark.asyncio
async def test_cloudflare_complete_success():
    provider = CloudflareProvider(api_key="fake", account_id="acc123")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "result": {"response": "cf result"},
        "success": True,
    }
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.complete("system", "user")
    assert result.text == "cf result"
    assert result.provider == "cloudflare"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && python -m pytest tests/test_ai_providers.py -v
```

Expected: new tests FAIL — modules not found

- [ ] **Step 3: Implement GroqProvider**

Create `backend/app/services/ai/providers/groq.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class GroqProvider(BaseProvider):
    name = "groq"
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.BASE_URL, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"Groq API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return ProviderResponse(
            text=text,
            model=data.get("model", model),
            provider=self.name,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            latency_ms=latency,
        )
```

- [ ] **Step 4: Implement DeepSeekProvider**

Create `backend/app/services/ai/providers/deepseek.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class DeepSeekProvider(BaseProvider):
    name = "deepseek"
    BASE_URL = "https://api.deepseek.com/chat/completions"
    DEFAULT_MODEL = "deepseek-chat"

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.BASE_URL, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"DeepSeek API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return ProviderResponse(
            text=text,
            model=data.get("model", model),
            provider=self.name,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            latency_ms=latency,
        )
```

- [ ] **Step 5: Implement OpenRouterProvider**

Create `backend/app/services/ai/providers/openrouter.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class OpenRouterProvider(BaseProvider):
    name = "openrouter"
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://medcore.kg",
            "X-Title": "MedCore KG",
        }
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.BASE_URL, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"OpenRouter API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return ProviderResponse(
            text=text,
            model=data.get("model", model),
            provider=self.name,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            latency_ms=latency,
        )
```

- [ ] **Step 6: Implement HuggingFaceProvider**

Create `backend/app/services/ai/providers/huggingface.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class HuggingFaceProvider(BaseProvider):
    name = "huggingface"
    BASE_URL = "https://api-inference.huggingface.co/models"
    DEFAULT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        url = f"{self.BASE_URL}/{model}"
        prompt = f"<s>[INST] {system_prompt}\n\n{user_prompt} [/INST]"
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": max_tokens,
                "return_full_text": False,
            },
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"HuggingFace API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data[0]["generated_text"] if isinstance(data, list) else data.get("generated_text", "")
        return ProviderResponse(
            text=text,
            model=model,
            provider=self.name,
            input_tokens=len(prompt.split()),
            output_tokens=len(text.split()),
            latency_ms=latency,
        )
```

- [ ] **Step 7: Implement CloudflareProvider**

Create `backend/app/services/ai/providers/cloudflare.py`:

```python
from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class CloudflareProvider(BaseProvider):
    name = "cloudflare"
    DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct"

    def __init__(self, api_key: str, account_id: str = "", timeout: int = 30) -> None:
        super().__init__(api_key=api_key, timeout=timeout)
        self.account_id = account_id

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> ProviderResponse:
        model = model or self.DEFAULT_MODEL
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{model}"
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"Cloudflare API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data.get("result", {}).get("response", "")
        return ProviderResponse(
            text=text,
            model=model,
            provider=self.name,
            input_tokens=0,
            output_tokens=0,
            latency_ms=latency,
        )
```

- [ ] **Step 8: Update providers __init__.py**

Update `backend/app/services/ai/providers/__init__.py`:

```python
from app.services.ai.providers.base import BaseProvider, ProviderResponse
from app.services.ai.providers.gemini import GeminiProvider
from app.services.ai.providers.groq import GroqProvider
from app.services.ai.providers.deepseek import DeepSeekProvider
from app.services.ai.providers.openrouter import OpenRouterProvider
from app.services.ai.providers.huggingface import HuggingFaceProvider
from app.services.ai.providers.cloudflare import CloudflareProvider

__all__ = [
    "BaseProvider",
    "ProviderResponse",
    "GeminiProvider",
    "GroqProvider",
    "DeepSeekProvider",
    "OpenRouterProvider",
    "HuggingFaceProvider",
    "CloudflareProvider",
]
```

- [ ] **Step 9: Run all provider tests**

Run:
```bash
cd backend && python -m pytest tests/test_ai_providers.py -v
```

Expected: all 14 tests PASS

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/ai/providers/ backend/tests/test_ai_providers.py
git commit -m "feat(ai): add Groq, DeepSeek, OpenRouter, HuggingFace, Cloudflare providers"
```

---

### Task 5: ProviderRouter with Fallback

**Files:**
- Create: `backend/app/services/ai/router.py`
- Create: `backend/tests/test_ai_gateway.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_ai_gateway.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement ProviderRouter**

Create `backend/app/services/ai/router.py`:

```python
from __future__ import annotations
import logging
from app.services.ai.providers.base import BaseProvider, ProviderResponse

logger = logging.getLogger(__name__)


class ProviderRouter:
    def __init__(
        self,
        providers: dict[str, BaseProvider],
        task_model_map: dict[str, dict],
    ) -> None:
        self.providers = providers
        self.task_model_map = task_model_map

    async def complete(
        self,
        task_type: str,
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> ProviderResponse:
        provider_names = self._get_providers_for_task(task_type)
        errors: list[str] = []

        for name in provider_names:
            provider = self.providers.get(name)
            if provider is None:
                continue
            try:
                result = await provider.complete(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    **kwargs,
                )
                return result
            except Exception as e:
                logger.warning("Provider %s failed for task %s: %s", name, task_type, str(e))
                errors.append(f"{name}: {e}")

        raise Exception(f"All AI providers failed for task '{task_type}': {'; '.join(errors)}")

    def _get_providers_for_task(self, task_type: str) -> list[str]:
        task_config = self.task_model_map.get(task_type)
        if task_config:
            return task_config["providers"]
        # Fallback: try all available providers
        return list(self.providers.keys())
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py -v
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai/router.py backend/tests/test_ai_gateway.py
git commit -m "feat(ai): add ProviderRouter with auto-fallback logic"
```

---

### Task 6: PromptManager and ResponseParser

**Files:**
- Create: `backend/app/services/ai/prompt_manager.py`
- Create: `backend/app/services/ai/response_parser.py`
- Modify: `backend/tests/test_ai_gateway.py`

- [ ] **Step 1: Add tests for PromptManager and ResponseParser**

Append to `backend/tests/test_ai_gateway.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py::test_prompt_manager_render -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement PromptManager**

Create `backend/app/services/ai/prompt_manager.py`:

```python
from __future__ import annotations


class PromptManager:
    def render(self, template: str, **kwargs) -> str:
        result = template
        for key, value in kwargs.items():
            result = result.replace(f"{{{key}}}", str(value))
        return result
```

- [ ] **Step 4: Implement ResponseParser**

Create `backend/app/services/ai/response_parser.py`:

```python
from __future__ import annotations
import json
import re


class ResponseParser:
    def extract_json(self, text: str) -> dict | list | None:
        # Try to find JSON in code fences first
        fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try to find raw JSON object or array
        for pattern in [r"\{[\s\S]*\}", r"\[[\s\S]*\]"]:
            match = re.search(pattern, text)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    continue

        return None
```

- [ ] **Step 5: Run all tests**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py -v
```

Expected: 11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai/prompt_manager.py backend/app/services/ai/response_parser.py backend/tests/test_ai_gateway.py
git commit -m "feat(ai): add PromptManager and ResponseParser"
```

---

### Task 7: AIGateway Main Service

**Files:**
- Create: `backend/app/services/ai/gateway.py`
- Modify: `backend/app/services/ai/__init__.py`
- Modify: `backend/tests/test_ai_gateway.py`

- [ ] **Step 1: Add tests for AIGateway**

Append to `backend/tests/test_ai_gateway.py`:

```python
from unittest.mock import patch, AsyncMock
from app.services.ai.gateway import AIGateway


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py::test_gateway_diagnose -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement AIGateway**

Create `backend/app/services/ai/gateway.py`:

```python
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

# --- Prompt templates (defaults, overridden by DB if available) ---
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
```

- [ ] **Step 4: Update services/ai/__init__.py**

Update `backend/app/services/ai/__init__.py`:

```python
from app.services.ai.gateway import AIGateway

__all__ = ["AIGateway"]
```

- [ ] **Step 5: Run all gateway tests**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py -v
```

Expected: 15 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai/gateway.py backend/app/services/ai/__init__.py backend/tests/test_ai_gateway.py
git commit -m "feat(ai): add AIGateway orchestrator with diagnosis, exam, summary, conclusion"
```

---

### Task 8: API Routes — Group A (Doctor's AI Assistant)

**Files:**
- Modify: `backend/app/api/v1/routes/ai.py`
- Create: `backend/tests/test_ai_routes.py`

- [ ] **Step 1: Write tests for new AI endpoints**

Create `backend/tests/test_ai_routes.py`:

```python
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.fixture
def mock_gateway():
    with patch("app.api.v1.routes.ai.AIGateway") as MockClass:
        instance = MockClass.return_value
        instance.suggest_diagnoses = AsyncMock(return_value={
            "suggestions": [{"icd_code": "J06.9", "title": "ОРВИ", "confidence": 0.85, "reasoning": "test"}],
            "provider": "gemini",
            "model": "gemini-2.0-flash",
        })
        instance.generate_exam = AsyncMock(return_value={
            "examination_text": "Осмотр текст",
            "provider": "gemini",
            "model": "gemini-2.0-flash",
        })
        instance.summarize_patient = AsyncMock(return_value={
            "summary": "Резюме",
            "key_diagnoses": [],
            "key_medications": [],
            "risk_factors": [],
            "provider": "groq",
            "model": "llama-3.3-70b",
        })
        instance.generate_conclusion = AsyncMock(return_value={
            "conclusion_text": "Заключение",
            "provider": "gemini",
            "model": "gemini-2.0-flash",
        })
        yield instance


def test_suggest_diagnoses_schema():
    """Verify the DiagnosisSuggestRequest schema accepts valid data."""
    from app.schemas.ai import DiagnosisSuggestRequest
    import uuid
    req = DiagnosisSuggestRequest(
        patient_id=uuid.uuid4(),
        symptoms="головная боль, температура",
        age=35,
        sex="M",
    )
    assert req.symptoms == "головная боль, температура"


def test_exam_generate_schema():
    from app.schemas.ai import ExamGenerateRequest
    import uuid
    req = ExamGenerateRequest(
        patient_id=uuid.uuid4(),
        complaints="боль в горле",
    )
    assert req.complaints == "боль в горле"


def test_conclusion_schema():
    from app.schemas.ai import ConclusionGenerateRequest
    import uuid
    req = ConclusionGenerateRequest(
        patient_id=uuid.uuid4(),
        diagnoses=["J06.9 ОРВИ"],
        exam_notes="Температура 37.5",
    )
    assert len(req.diagnoses) == 1
```

- [ ] **Step 2: Run tests to verify they pass (schema tests should pass)**

Run:
```bash
cd backend && python -m pytest tests/test_ai_routes.py -v
```

Expected: 3 schema tests PASS

- [ ] **Step 3: Extend ai.py routes with new endpoints**

Replace `backend/app/api/v1/routes/ai.py` with the full version — keeping existing endpoints and adding new ones:

```python
from __future__ import annotations
import uuid
import os
import tempfile
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from app.api.deps import CurrentUser, DBSession, require_role
from app.models.user import UserRole
from app.core.config import settings
from app.schemas.ai import (
    DiagnosisSuggestRequest,
    DiagnosisSuggestResponse,
    ExamGenerateRequest,
    ExamGenerateResponse,
    PatientSummaryRequest,
    PatientSummaryResponse,
    ConclusionGenerateRequest,
    ConclusionGenerateResponse,
    TreatmentSuggestRequest,
    TreatmentSuggestResponse,
    LabOrderSuggestRequest,
    LabOrderSuggestResponse,
)
from app.services.ai.gateway import AIGateway
from app.models.ai import AIUsageLog, AIGeneratedContent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "uploads")

_gateway: AIGateway | None = None


def get_gateway() -> AIGateway:
    global _gateway
    if _gateway is None:
        _gateway = AIGateway()
    return _gateway


# ---------- Existing endpoints (keep as-is) ----------

@router.post("/analyze-medical-document")
async def analyze_medical_document(
    file: UploadFile = File(...),
    patient_id: uuid.UUID = Form(...),
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.CLINIC_ADMIN),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename or "document")[1] or ".bin"
    saved_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    file_url = f"/uploads/{saved_filename}"
    return {
        "document_url": file_url,
        "entry_type": "ai_generated",
        "extracted_data": {
            "document_type": {"value": "discharge_summary", "confidence": 0.9},
            "document_date": {"value": None, "confidence": 0.0},
            "facility": {"value": None, "confidence": 0.0},
            "doctor": {"value": None, "confidence": 0.0},
            "diagnoses": [],
            "medications": [],
            "lab_values": [],
            "recommendations": {"value": None, "confidence": 0.0},
            "raw_text": "Document analysis placeholder - integrate Claude API for production",
            "notes": "Mock analysis - real AI integration pending",
        },
        "overall_confidence": 0.0,
        "ai_notes": "This is a placeholder response. Integrate Claude Vision API for real document analysis.",
        "suggested_title": "Загруженный документ",
    }


@router.post("/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.DOCTOR, UserRole.NURSE),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 50MB)")
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    saved_filename = f"audio-{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    return {"url": f"/uploads/{saved_filename}", "filename": saved_filename, "size": len(audio_bytes)}


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("ru"),
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.NURSE, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")
    allowed_types = [
        "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
        "audio/wav", "audio/x-wav", "audio/mp3", "video/webm",
    ]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {file.content_type}")
    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file is too small or empty")
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    try:
        import httpx
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(tmp_path, "rb") as audio_file:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    files={"file": (f"audio{ext}", audio_file, file.content_type or "audio/webm")},
                    data={"model": "whisper-1", "language": language, "response_format": "json"},
                )
        os.unlink(tmp_path)
        if response.status_code != 200:
            logger.error("Whisper API error %s: %s", response.status_code, response.text)
            raise HTTPException(status_code=502, detail="Whisper API error")
        result = response.json()
        return {"text": result.get("text", ""), "language": language}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Whisper API timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ---------- New AI Gateway endpoints ----------

@router.post("/diagnosis/suggest")
async def suggest_diagnoses(
    body: DiagnosisSuggestRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.suggest_diagnoses(
            symptoms=body.symptoms,
            age=body.age,
            sex=body.sex,
            existing_diagnoses=body.existing_diagnoses,
        )
        # Log usage
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="diagnosis",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        # Save generated content
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="diagnosis",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI diagnosis suggest failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/exam/generate")
async def generate_exam(
    body: ExamGenerateRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.generate_exam(
            complaints=body.complaints,
            visit_type=body.visit_type,
        )
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="exam",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="exam",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI exam generate failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/summary/patient")
async def summarize_patient(
    body: PatientSummaryRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN, UserRole.NURSE),
):
    try:
        # Fetch patient history from DB
        from sqlalchemy import select
        from app.models.medical import Visit
        from app.models.diagnosis import Diagnosis

        visits_q = await session.execute(
            select(Visit).where(Visit.patient_id == body.patient_id).order_by(Visit.created_at.desc()).limit(20)
        )
        visits = visits_q.scalars().all()

        diagnoses_q = await session.execute(
            select(Diagnosis).where(Diagnosis.patient_id == body.patient_id, Diagnosis.is_deleted == False)
        )
        diagnoses = diagnoses_q.scalars().all()

        history_parts = []
        for v in visits:
            history_parts.append(f"Визит ({v.visit_type.value}): жалобы={v.chief_complaint or 'н/д'}, осмотр={v.examination_notes or 'н/д'}, диагноз={v.diagnosis_text or 'н/д'}")
        for d in diagnoses:
            history_parts.append(f"Диагноз: {d.icd_code} {d.title} (статус: {d.status.value})")

        history_text = "\n".join(history_parts) if history_parts else "История болезни пуста."

        gateway = get_gateway()
        result = await gateway.summarize_patient(history_text=history_text)

        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="summary",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="summary",
            input_data={"patient_id": str(body.patient_id)},
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI patient summary failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/conclusion/generate")
async def generate_conclusion(
    body: ConclusionGenerateRequest,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.DOCTOR, UserRole.CLINIC_ADMIN),
):
    try:
        gateway = get_gateway()
        result = await gateway.generate_conclusion(
            diagnoses=body.diagnoses,
            exam_notes=body.exam_notes,
            treatment=body.treatment,
        )
        log_entry = AIUsageLog(
            clinic_id=current_user.clinic_id,
            user_id=current_user.id,
            patient_id=body.patient_id,
            task_type="conclusion",
            provider_used=result.get("provider", "unknown"),
            model_used=result.get("model", "unknown"),
            input_tokens=0,
            output_tokens=0,
            latency_ms=0,
            success=True,
        )
        session.add(log_entry)
        content_entry = AIGeneratedContent(
            clinic_id=current_user.clinic_id,
            patient_id=body.patient_id,
            task_type="conclusion",
            input_data=body.model_dump(mode="json"),
            output_data=result,
        )
        session.add(content_entry)
        return result
    except Exception as e:
        logger.exception("AI conclusion generate failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
```

- [ ] **Step 4: Run all tests**

Run:
```bash
cd backend && python -m pytest tests/test_ai_routes.py tests/test_ai_gateway.py tests/test_ai_providers.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/ai.py backend/app/schemas/ai.py backend/tests/test_ai_routes.py
git commit -m "feat(ai): add Group A API routes — diagnosis, exam, summary, conclusion"
```

---

### Task 9: AI Usage Stats and Prompt Admin Endpoints

**Files:**
- Modify: `backend/app/api/v1/routes/ai.py`

- [ ] **Step 1: Add usage stats and prompt management endpoints**

Append to `backend/app/api/v1/routes/ai.py`:

```python
from sqlalchemy import select, func
from app.models.ai import AIPromptTemplate


@router.get("/usage")
async def get_ai_usage(
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN),
):
    clinic_id = current_user.clinic_id

    total_q = await session.execute(
        select(func.count(AIUsageLog.id)).where(AIUsageLog.clinic_id == clinic_id)
    )
    total = total_q.scalar() or 0

    success_q = await session.execute(
        select(func.count(AIUsageLog.id)).where(AIUsageLog.clinic_id == clinic_id, AIUsageLog.success == True)
    )
    successful = success_q.scalar() or 0

    avg_lat_q = await session.execute(
        select(func.avg(AIUsageLog.latency_ms)).where(AIUsageLog.clinic_id == clinic_id, AIUsageLog.success == True)
    )
    avg_latency = round(avg_lat_q.scalar() or 0, 1)

    tokens_q = await session.execute(
        select(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens)).where(AIUsageLog.clinic_id == clinic_id)
    )
    tokens_used = tokens_q.scalar() or 0

    by_provider_q = await session.execute(
        select(AIUsageLog.provider_used, func.count(AIUsageLog.id))
        .where(AIUsageLog.clinic_id == clinic_id)
        .group_by(AIUsageLog.provider_used)
    )
    by_provider = {row[0]: row[1] for row in by_provider_q.all()}

    by_task_q = await session.execute(
        select(AIUsageLog.task_type, func.count(AIUsageLog.id))
        .where(AIUsageLog.clinic_id == clinic_id)
        .group_by(AIUsageLog.task_type)
    )
    by_task = {row[0]: row[1] for row in by_task_q.all()}

    return {
        "total_requests": total,
        "successful_requests": successful,
        "failed_requests": total - successful,
        "avg_latency_ms": avg_latency,
        "tokens_used": tokens_used,
        "by_provider": by_provider,
        "by_task_type": by_task,
    }


@router.get("/prompts")
async def list_prompts(
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.SUPER_ADMIN),
):
    result = await session.execute(
        select(AIPromptTemplate).where(AIPromptTemplate.is_deleted == False).order_by(AIPromptTemplate.task_type)
    )
    templates = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "task_type": t.task_type,
            "system_prompt": t.system_prompt,
            "user_prompt_template": t.user_prompt_template,
            "model_tier": t.model_tier.value,
            "version": t.version,
            "is_active": t.is_active,
            "created_at": t.created_at.isoformat(),
        }
        for t in templates
    ]


@router.put("/prompts/{prompt_id}")
async def update_prompt(
    prompt_id: uuid.UUID,
    body: dict,
    session: DBSession = None,
    current_user: CurrentUser = None,
    _staff=require_role(UserRole.SUPER_ADMIN),
):
    result = await session.execute(
        select(AIPromptTemplate).where(AIPromptTemplate.id == prompt_id, AIPromptTemplate.is_deleted == False)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Prompt template not found")

    for field in ["system_prompt", "user_prompt_template", "model_tier", "is_active"]:
        if field in body and body[field] is not None:
            setattr(template, field, body[field])
    template.version += 1
    await session.flush()
    await session.refresh(template)
    return {"id": str(template.id), "task_type": template.task_type, "version": template.version}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/v1/routes/ai.py
git commit -m "feat(ai): add AI usage stats and prompt admin endpoints"
```

---

### Task 10: Seed Default Prompt Templates and Update .env.example

**Files:**
- Create: `backend/seed_ai_prompts.py`
- Modify: `backend/.env.example` (or root `.env.example`)

- [ ] **Step 1: Create seed script for default prompts**

Create `backend/seed_ai_prompts.py`:

```python
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
```

- [ ] **Step 2: Update .env.example with new AI keys**

Add to the end of `backend/../.env.example` (root `.env.example`):

```
# AI Gateway providers (free tier)
GROQ_API_KEY=
OPENROUTER_API_KEY=
HF_API_TOKEN=
CF_ACCOUNT_ID=
CF_API_TOKEN=
AI_REQUEST_TIMEOUT=30
```

- [ ] **Step 3: Run seed script**

Run:
```bash
cd backend && python seed_ai_prompts.py
```

Expected: 6 prompt templates inserted (or skipped if already exist)

- [ ] **Step 4: Commit**

```bash
git add backend/seed_ai_prompts.py .env.example
git commit -m "feat(ai): add seed script for default AI prompt templates"
```

---

### Task 11: Integration Test — Full Flow

**Files:**
- Modify: `backend/tests/test_ai_gateway.py`

- [ ] **Step 1: Add integration test for full AI flow**

Append to `backend/tests/test_ai_gateway.py`:

```python
@pytest.mark.asyncio
async def test_full_flow_diagnosis_to_conclusion():
    """Integration test: diagnose → exam → conclusion pipeline."""
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
```

- [ ] **Step 2: Run all tests**

Run:
```bash
cd backend && python -m pytest tests/test_ai_gateway.py tests/test_ai_providers.py tests/test_ai_routes.py -v
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_ai_gateway.py
git commit -m "test(ai): add full-flow integration test for AI pipeline"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Config + SQLAlchemy models + migration | — |
| 2 | Pydantic schemas | — |
| 3 | BaseProvider + GeminiProvider | 4 tests |
| 4 | 5 remaining providers | 10 tests |
| 5 | ProviderRouter with fallback | 5 tests |
| 6 | PromptManager + ResponseParser | 6 tests |
| 7 | AIGateway orchestrator | 4 tests |
| 8 | Group A API routes (4 endpoints) | 3 schema tests |
| 9 | Usage stats + prompt admin endpoints | — |
| 10 | Seed prompts + .env.example | — |
| 11 | Full-flow integration test | 1 test |

**Total: 11 tasks, ~33 tests, ~11 commits**
