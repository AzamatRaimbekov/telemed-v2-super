import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WsMessage } from "./types";
import { playCriticalSound, playWarningSound } from "@/features/monitoring/alert-sound";

const WS_BASE = window.location.protocol === "https:" ? "wss:" : "ws:";

export function useBmsWS() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const url = `${WS_BASE}//${window.location.host}/api/v1/infrastructure/ws?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

      if (msg.type === "sensor_update") {
        // Update floor sensors cache in-place
        queryClient.setQueryData(
          ["bms-floor-sensors", msg.floor_id],
          (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((s) =>
              s.id === msg.sensor_id
                ? { ...s, last_value: msg.value, last_value_text: msg.value_text, last_reading_at: new Date().toISOString() }
                : s,
            );
          },
        );

        // Play sound for critical/emergency
        if (msg.severity === "CRITICAL" || msg.severity === "EMERGENCY") {
          playCriticalSound();
        } else if (msg.severity === "WARNING") {
          playWarningSound();
        }
      }

      if (msg.type === "alert") {
        queryClient.invalidateQueries({ queryKey: ["bms-alerts"] });
        queryClient.invalidateQueries({ queryKey: ["bms-dashboard"] });
        const alert = msg.alert;
        if (alert.severity === "CRITICAL" || alert.severity === "EMERGENCY") {
          playCriticalSound();
          toast.error(alert.title, { description: alert.message, duration: 15000 });
        } else {
          playWarningSound();
          toast.warning(alert.title, { description: alert.message });
        }
      }

      if (msg.type === "equipment_update") {
        queryClient.invalidateQueries({ queryKey: ["bms-equipment"] });
        queryClient.invalidateQueries({ queryKey: ["bms-floor-equipment"] });
        queryClient.invalidateQueries({ queryKey: ["bms-room-equipment"] });
      }

      if (msg.type === "automation_triggered") {
        toast.info(`Автоматизация: ${msg.rule_name}`, {
          description: `${msg.action} — ${msg.room}`,
        });
        queryClient.invalidateQueries({ queryKey: ["bms-rules"] });
      }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
