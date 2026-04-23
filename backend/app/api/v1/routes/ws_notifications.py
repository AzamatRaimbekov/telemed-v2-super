from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.ws_manager import ws_manager
from jose import jwt
from app.core.config import settings

router = APIRouter(tags=["WebSocket Notifications"])

@router.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket, token: str = Query(None)):
    """WebSocket for real-time notifications. Connect with ?token=JWT"""
    user_id = None
    try:
        # Verify JWT
        if token:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("sub") or payload.get("user_id")

        if not user_id:
            await websocket.close(code=4001, reason="Authentication required")
            return

        await ws_manager.connect(websocket, user_id)

        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "online_users": ws_manager.online_count,
        })

        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if user_id:
            ws_manager.disconnect(websocket, user_id)

@router.get("/ws/online-count")
async def online_count():
    return {"online": ws_manager.online_count}
