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
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        prompt = f"<s>[INST] {system_prompt}\n\n{user_prompt} [/INST]"
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": temperature,
                "max_new_tokens": max_tokens,
                "return_full_text": False,
            },
        }
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"HuggingFace API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data[0]["generated_text"]
        # Estimate token counts from word count
        input_tokens = len(prompt.split())
        output_tokens = len(text.split())
        return ProviderResponse(
            text=text,
            model=model,
            provider=self.name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency,
        )
