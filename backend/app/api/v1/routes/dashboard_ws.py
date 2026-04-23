from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.database import async_session_factory
from sqlalchemy import select, func
import asyncio
import json

router = APIRouter(tags=["Dashboard WebSocket"])


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            async with async_session_factory() as db:
                # Quick stats query
                from app.models.patient import Patient
                from app.models.appointment import Appointment

                patient_count = (
                    await db.execute(
                        select(func.count(Patient.id)).where(
                            Patient.is_deleted == False
                        )
                    )
                ).scalar() or 0

                data = {
                    "type": "dashboard_update",
                    "patients_total": patient_count,
                    "timestamp": __import__("datetime")
                    .datetime.utcnow()
                    .isoformat(),
                }
            await websocket.send_json(data)
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()
