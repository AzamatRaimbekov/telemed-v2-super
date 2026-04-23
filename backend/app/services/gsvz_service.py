import httpx
from app.core.config import settings


class GSVZService:
    """Integration with GSVZ -- Государственная система здравоохранения Кыргызстана."""

    def __init__(self):
        self.base_url = getattr(settings, "GSVZ_API_URL", "")
        self.api_key = getattr(settings, "GSVZ_API_KEY", "")

    async def verify_patient_insurance(self, inn: str) -> dict:
        """Check patient's insurance status via GSVZ."""
        if not self.base_url:
            return {
                "status": "demo",
                "message": "GSVZ не настроена",
                "insured": True,
                "policy_number": f"DEMO-{inn[:6]}",
            }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/insurance/verify",
                params={"inn": inn},
                headers={"X-API-Key": self.api_key},
            )
            resp.raise_for_status()
            return resp.json()

    async def submit_visit_report(self, visit_data: dict) -> dict:
        """Submit visit report to GSVZ for statistics."""
        if not self.base_url:
            return {"status": "demo", "message": "Отчёт не отправлен -- GSVZ не настроена"}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base_url}/visits/report",
                json=visit_data,
                headers={"X-API-Key": self.api_key},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_icd10_updates(self) -> dict:
        """Fetch latest ICD-10 updates from GSVZ."""
        if not self.base_url:
            return {"status": "demo", "updates": []}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/icd10/updates",
                headers={"X-API-Key": self.api_key},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_status(self) -> dict:
        """Check GSVZ connection status."""
        if not self.base_url:
            return {
                "connected": False,
                "mode": "demo",
                "message": "GSVZ API URL не настроен. Работает в демо-режиме.",
            }
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self.base_url}/health",
                    headers={"X-API-Key": self.api_key},
                )
                resp.raise_for_status()
                return {"connected": True, "mode": "live", "message": "Подключение к ГСВЗ активно"}
        except Exception as e:
            return {
                "connected": False,
                "mode": "error",
                "message": f"Ошибка подключения: {str(e)[:200]}",
            }
