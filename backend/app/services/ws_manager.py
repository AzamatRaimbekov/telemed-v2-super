"""WebSocket connection manager for real-time push notifications."""
from fastapi import WebSocket
import json
from typing import Dict, Set


class ConnectionManager:
    """Manages WebSocket connections per user."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}  # user_id -> set of websockets

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user (all their connections)."""
        if user_id in self.active_connections:
            disconnected = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.add(ws)
            for ws in disconnected:
                self.active_connections[user_id].discard(ws)

    async def broadcast(self, message: dict, clinic_id: str | None = None):
        """Send message to all connected users."""
        disconnected_users = []
        for user_id, connections in self.active_connections.items():
            disconnected = set()
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.add(ws)
            connections -= disconnected
            if not connections:
                disconnected_users.append(user_id)
        for uid in disconnected_users:
            del self.active_connections[uid]

    @property
    def online_count(self) -> int:
        return len(self.active_connections)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections


# Global instance
ws_manager = ConnectionManager()
