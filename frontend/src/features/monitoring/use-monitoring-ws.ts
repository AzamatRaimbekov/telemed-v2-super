import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WsMessage } from "./types";
import { playCriticalSound, playWarningSound } from "./alert-sound";

const WS_BASE = window.location.protocol === "https:" ? "wss:" : "ws:";

export function useMonitoringWS(patientId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const url = `${WS_BASE}//${window.location.host}/api/v1/monitoring/${patientId}/ws?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

      if (msg.type === "sensor_update") {
        // Update current readings cache
        queryClient.setQueryData(
          ["monitoring-readings", patientId],
          (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((r) =>
              r.sensor_id === msg.sensor_id
                ? { ...r, value: msg.value, value_secondary: msg.value_secondary, value_text: msg.value_text, severity: msg.severity, recorded_at: msg.timestamp }
                : r,
            );
          },
        );

        // Sound for critical
        if (msg.severity === "CRITICAL") {
          playCriticalSound();
        } else if (msg.severity === "WARNING") {
          playWarningSound();
        }
      }

      if (msg.type === "alert") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
        if (msg.alert.severity === "CRITICAL") {
          playCriticalSound();
          toast.error(msg.alert.title, { description: msg.alert.message, duration: 15000 });
        } else {
          playWarningSound();
          toast.warning(msg.alert.title, { description: msg.alert.message });
        }
      }

      if (msg.type === "alert_update") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-alerts", patientId] });
      }

      if (msg.type === "nurse_call_update") {
        queryClient.invalidateQueries({ queryKey: ["monitoring-nurse-calls", patientId] });
      }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [patientId, queryClient]);

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
