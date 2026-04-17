import httpx
import structlog
from typing import Optional
from .base import AIProvider, AIResponse

logger = structlog.get_logger()

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


class GeminiProvider(AIProvider):
    name = "gemini"

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

        tools = []
        if functions:
            tools = [{"function_declarations": functions}]

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
        }
        if tools:
            payload["tools"] = tools

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    GEMINI_API_URL,
                    params={"key": self.api_key},
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            candidate = data["candidates"][0]["content"]["parts"][0]

            if "functionCall" in candidate:
                fc = candidate["functionCall"]
                return AIResponse(
                    text="",
                    function_call={"name": fc["name"], "args": fc.get("args", {})},
                )

            return AIResponse(text=candidate.get("text", ""))

        except Exception as e:
            logger.warning("gemini_error", error=str(e))
            return AIResponse(text="", error=True)
