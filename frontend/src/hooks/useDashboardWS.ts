import { useState, useEffect, useRef } from "react";

interface DashboardUpdate {
  type: string;
  patients_total: number;
  timestamp: string;
}

export function useDashboardWS() {
  const [data, setData] = useState<DashboardUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/v1/ws/dashboard`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setData(JSON.parse(event.data));
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { data, connected };
}
