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
        return list(self.providers.keys())
