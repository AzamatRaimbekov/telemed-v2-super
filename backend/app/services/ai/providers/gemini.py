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
