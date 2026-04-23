import { useState, useEffect, useRef } from "react";

interface WSMessage {
  type: string;
  [key: string]: any;
}

export function useRealtimeNotifications(onMessage?: (msg: WSMessage) => void) {
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws/notifications?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setOnlineCount(data.online_users || 0);
        }
        onMessage?.(data);
      } catch {}
    };

    // Ping every 30s
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  return { connected, onlineCount };
}
