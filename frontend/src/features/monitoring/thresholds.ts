import type { DeviceType } from "./types";

type SensorMeta = {
  label: string;
  unit: string;
  icon: string;       // short label for compact view
  format: (v: number | null, v2?: number | null) => string;
  colorNormal: string;
  colorWarning: string;
  colorCritical: string;
};

export const SENSOR_META: Partial<Record<DeviceType, SensorMeta>> = {
  HEART_RATE: {
    label: "Пульс", unit: "уд/мин", icon: "♥",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  SPO2: {
    label: "SpO2", unit: "%", icon: "O₂",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  BODY_TEMPERATURE: {
    label: "Темп. тела", unit: "°C", icon: "🌡",
    format: (v) => v != null ? v.toFixed(1) : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  BLOOD_PRESSURE: {
    label: "Давление", unit: "мм рт.ст.", icon: "♡",
    format: (v, v2) => v != null && v2 != null ? `${Math.round(v)}/${Math.round(v2)}` : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  FALL_DETECTOR: {
    label: "Падение", unit: "", icon: "⚠",
    format: (_v, _v2) => "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  ROOM_TEMPERATURE: {
    label: "Палата", unit: "°C", icon: "🏠",
    format: (v) => v != null ? v.toFixed(1) : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  HUMIDITY: {
    label: "Влажность", unit: "%", icon: "💧",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-secondary", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  MOTION: {
    label: "Движение", unit: "", icon: "👁",
    format: (_v, _v2) => "—",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  DOOR: {
    label: "Дверь", unit: "", icon: "🚪",
    format: (_v, _v2) => "—",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
};

export function getSeverityColor(severity: string, meta: SensorMeta): string {
  if (severity === "CRITICAL") return meta.colorCritical;
  if (severity === "WARNING") return meta.colorWarning;
  return meta.colorNormal;
}
