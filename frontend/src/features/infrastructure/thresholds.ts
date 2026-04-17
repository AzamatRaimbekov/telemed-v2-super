import type { BmsSensorType, EquipmentType, EquipmentStatus, BmsRoomType } from "./types";

// ── Sensor metadata ──

type BmsSensorMeta = {
  label: string;
  unit: string;
  icon: string;
  format: (v: number | null, vt?: string | null) => string;
  colorNormal: string;
  colorWarning: string;
  colorCritical: string;
};

export const BMS_SENSOR_META: Record<BmsSensorType, BmsSensorMeta> = {
  TEMPERATURE: {
    label: "Температура", unit: "°C", icon: "🌡",
    format: (v) => v != null ? `${v.toFixed(1)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  HUMIDITY: {
    label: "Влажность", unit: "%", icon: "💧",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  CO2: {
    label: "CO₂", unit: "ppm", icon: "🌬",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  LIGHT: {
    label: "Освещённость", unit: "lux", icon: "💡",
    format: (v) => v != null ? `${Math.round(v)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  SMOKE: {
    label: "Дым", unit: "", icon: "🔥",
    format: (_v, vt) => vt === "DETECTED" ? "Обнаружен" : "Норма",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  WATER_LEAK: {
    label: "Протечка", unit: "", icon: "🚰",
    format: (_v, vt) => vt === "DETECTED" ? "Обнаружена" : "Норма",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  MOTION: {
    label: "Движение", unit: "", icon: "👁",
    format: (_v, vt) => vt === "DETECTED" ? "Обнаружено" : "Нет",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  DOOR_SENSOR: {
    label: "Дверь", unit: "", icon: "🚪",
    format: (_v, vt) => vt === "OPEN" ? "Открыта" : "Закрыта",
    colorNormal: "text-[var(--color-text-tertiary)]", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  POWER_METER: {
    label: "Эл. энергия", unit: "kWh", icon: "⚡",
    format: (v) => v != null ? `${v.toFixed(1)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
  PIPE_TEMPERATURE: {
    label: "Темп. трубы", unit: "°C", icon: "🔧",
    format: (v) => v != null ? `${v.toFixed(1)}` : "—",
    colorNormal: "text-success", colorWarning: "text-warning", colorCritical: "text-destructive",
  },
};

export function getBmsSeverityColor(severity: string, meta: BmsSensorMeta): string {
  if (severity === "CRITICAL" || severity === "EMERGENCY") return meta.colorCritical;
  if (severity === "WARNING") return meta.colorWarning;
  return meta.colorNormal;
}

// ── Equipment type labels ──

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  AC: "Кондиционер",
  HEATER: "Обогреватель",
  LIGHT: "Освещение",
  VENTILATION: "Вентиляция",
  DOOR_LOCK: "Замок двери",
  ELEVATOR: "Лифт",
  PUMP: "Насос",
  GENERATOR: "Генератор",
  UPS: "ИБП",
  OTHER: "Другое",
};

// ── Equipment status meta ──

type StatusMeta = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
};

export const EQUIPMENT_STATUS_META: Record<EquipmentStatus, StatusMeta> = {
  ON: { label: "Включено", variant: "default", color: "text-success" },
  OFF: { label: "Выключено", variant: "secondary", color: "text-[var(--color-text-tertiary)]" },
  ERROR: { label: "Ошибка", variant: "destructive", color: "text-destructive" },
  MAINTENANCE: { label: "Обслуживание", variant: "outline", color: "text-warning" },
  STANDBY: { label: "Ожидание", variant: "outline", color: "text-primary" },
};

// ── Room type labels ──

export const ROOM_TYPE_LABELS: Record<BmsRoomType, string> = {
  WARD: "Палата",
  CORRIDOR: "Коридор",
  SERVER: "Серверная",
  TECHNICAL: "Техническое",
  OFFICE: "Кабинет",
  OPERATING: "Операционная",
  LAB: "Лаборатория",
  RECEPTION: "Приёмная",
  PHARMACY: "Аптека",
  STORAGE: "Склад",
  BATHROOM: "Санузел",
  KITCHEN: "Кухня",
  OTHER: "Другое",
};
