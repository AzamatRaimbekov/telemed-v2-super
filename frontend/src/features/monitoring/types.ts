export type DeviceType =
  | "HEART_RATE" | "SPO2" | "BODY_TEMPERATURE" | "BLOOD_PRESSURE"
  | "FALL_DETECTOR" | "ROOM_TEMPERATURE" | "HUMIDITY" | "MOTION" | "DOOR" | "NURSE_CALL";

export type DeviceCategory = "WEARABLE" | "STATIONARY";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
export type NurseCallStatus = "CALLED" | "ACCEPTED" | "EN_ROUTE" | "ON_SITE" | "RESOLVED";
export type CameraType = "OVERVIEW" | "BEDSIDE" | "ENTRANCE" | "OTHER";

export type Camera = {
  id: string;
  room_id: string;
  name: string;
  camera_type: CameraType;
  stream_url: string | null;
  is_active: boolean;
  position_order: number;
};

export type SensorReading = {
  sensor_id: string;
  device_type: DeviceType;
  device_category: DeviceCategory;
  name: string;
  value: number | null;
  value_secondary: number | null;
  value_text: string | null;
  unit: string;
  recorded_at: string | null;
  severity: "NORMAL" | "WARNING" | "CRITICAL";
};

export type Alert = {
  id: string;
  patient_id: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type NurseCall = {
  id: string;
  patient_id: string;
  room_id: string;
  status: NurseCallStatus;
  called_at: string;
  accepted_at: string | null;
  en_route_at: string | null;
  on_site_at: string | null;
  resolved_at: string | null;
  accepted_by_name: string | null;
  resolved_by_name: string | null;
  response_time_seconds: number | null;
};

export type ReadingPoint = {
  value: number | null;
  value_secondary: number | null;
  value_text: string | null;
  unit: string;
  recorded_at: string;
};

export type WsMessage =
  | { type: "sensor_update"; sensor_id: string; device_type: DeviceType; value: number | null; value_secondary: number | null; value_text: string | null; unit: string; severity: string; timestamp: string }
  | { type: "alert"; alert: Alert }
  | { type: "alert_update"; alert_id: string; status: AlertStatus }
  | { type: "nurse_call_update"; call: NurseCall };
