from __future__ import annotations


class PromptManager:
    def render(self, template: str, **kwargs) -> str:
        result = template
        for key, value in kwargs.items():
            result = result.replace(f"{{{key}}}", str(value))
        return result
