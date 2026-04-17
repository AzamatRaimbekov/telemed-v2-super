from abc import ABC, abstractmethod
from typing import Optional
import structlog

logger = structlog.get_logger()


class AIResponse:
    def __init__(
        self,
        text: str,
        function_call: Optional[dict] = None,
        error: bool = False,
    ):
        self.text = text
        self.function_call = function_call
        self.error = error


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def generate(
        self,
        user_message: str,
        system_prompt: str,
        functions: list[dict],
    ) -> AIResponse:
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        pass
