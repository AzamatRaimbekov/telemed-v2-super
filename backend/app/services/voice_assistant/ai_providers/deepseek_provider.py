import httpx
import json
import structlog
from typing import Optional
from .base import AIProvider, AIResponse

logger = structlog.get_logger()

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class DeepSeekProvider(AIProvider):
    name = "deepseek"

    def __init__(self, api_key: str, timeout: int = 5):
        self.api_key = api_key
        self.timeout = timeout

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        user_message: str,
        system_prompt: str,
        functions: list[dict],
    ) -> AIResponse:
        if not self.api_key:
            return AIResponse(text="", error=True)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        payload: dict = {
            "model": "deepseek-chat",
            "messages": messages,
            "max_tokens": 300,
        }

        if functions:
            payload["tools"] = [
                {"type": "function", "function": f} for f in functions
            ]

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    DEEPSEEK_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            choice = data["choices"][0]["message"]

            if choice.get("tool_calls"):
                tc = choice["tool_calls"][0]["function"]
                return AIResponse(
                    text="",
                    function_call={
                        "name": tc["name"],
                        "args": json.loads(tc["arguments"]),
                    },
                )

            return AIResponse(text=choice.get("content", ""))

        except Exception as e:
            logger.warning("deepseek_error", error=str(e))
            return AIResponse(text="", error=True)
