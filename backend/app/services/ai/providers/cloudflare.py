from __future__ import annotations
import time
import httpx
from app.services.ai.providers.base import BaseProvider, ProviderResponse


class CloudflareProvider(BaseProvider):
    name = "cloudflare"
    DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct"

    def __init__(self, api_key: str, timeout: int = 30, account_id: str = "") -> None:
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
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise Exception(f"Cloudflare API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        text = data["result"]["response"]
        return ProviderResponse(
            text=text,
            model=model,
            provider=self.name,
            input_tokens=0,
            output_tokens=0,
            latency_ms=latency,
        )
