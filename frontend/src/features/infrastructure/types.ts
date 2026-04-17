// ── Enum-like union types ──

export type BmsRoomType =
  | "WARD" | "CORRIDOR" | "SERVER" | "TECHNICAL" | "OFFICE"
  | "OPERATING" | "LAB" | "RECEPTION" | "PHARMACY" | "STORAGE"
  | "BATHROOM" | "KITCHEN" | "OTHER";

export type BmsSensorType =
  | "TEMPERATURE" | "HUMIDITY" | "CO2" | "LIGHT" | "SMOKE"
  | "WATER_LEAK" | "MOTION" | "DOOR_SENSOR" | "POWER_METER" | "PIPE_TEMPERATURE";

export type EquipmentType =
  | "AC" | "HEATER" | "LIGHT" | "VENTILATION" | "DOOR_LOCK"
  | "ELEVATOR" | "PUMP" | "GENERATOR" | "UPS" | "OTHER";

export type EquipmentStatus = "ON" | "OFF" | "ERROR" | "MAINTENANCE" | "STANDBY";

export type EquipmentCommandType = "TURN_ON" | "TURN_OFF" | "SET_PARAMETER" | "RESTART";

export type CommandStatus = "PENDING" | "EXECUTED" | "FAILED";

export type BmsAlertType =
  | "HIGH_TEMPERATURE" | "LOW_TEMPERATURE" | "HIGH_HUMIDITY" | "LOW_HUMIDITY"
  | "HIGH_CO2" | "SMOKE_DETECTED" | "WATER_LEAK" | "POWER_OUTAGE"
  | "EQUIPMENT_ERROR" | "DOOR_FORCED" | "MOTION_AFTER_HOURS"
  | "SENSOR_OFFLINE" | "PIPE_FREEZE_RISK";

export type BmsAlertSeverity = "INFO" | "WARNING" | "CRITICAL" | "EMERGENCY";

export type BmsAlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "AUTO_RESOLVED";

export type ConditionOperator = "GT" | "LT" | "EQ" | "GTE" | "LTE";

export type BmsSensorSeverity = "NORMAL" | "WARNING" | "CRITICAL" | "EMERGENCY";

// ── Domain models ──

export type Building = {
  id: string;
  clinic_id: string;
  name: string;
  address: string | null;
  total_floors: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Floor = {
  id: string;
  clinic_id: string;
  building_id: string;
  floor_number: number;
  name: string;
  grid_cols: number;
  grid_rows: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Zone = {
  id: string;
  clinic_id: string;
  floor_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type BmsRoom = {
  id: string;
  clinic_id: string;
  floor_id: string;
  zone_id: string | null;
  name: string;
  room_type: BmsRoomType;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  linked_room_id: string | null;
  zone?: Zone | null;
  sensors?: BmsSensor[];
  equipment?: Equipment[];
  created_at: string;
  updated_at: string;
};

export type BmsSensor = {
  id: string;
  clinic_id: string;
  bms_room_id: string;
  floor_id: string;
  sensor_type: BmsSensorType;
  name: string;
  serial_number: string | null;
  is_active: boolean;
  last_value: number | null;
  last_value_text: string | null;
  last_reading_at: string | null;
  grid_x_offset: number;
  grid_y_offset: number;
  created_at: string;
  updated_at: string;
};

export type BmsSensorReading = {
  id: string;
  sensor_id: string;
  value: number | null;
  value_text: string | null;
  unit: string;
  recorded_at: string;
};

export type Equipment = {
  id: string;
  clinic_id: string;
  bms_room_id: string;
  equipment_type: EquipmentType;
  name: string;
  model: string | null;
  status: EquipmentStatus;
  parameters: Record<string, unknown> | null;
  is_controllable: boolean;
  last_status_change: string | null;
  created_at: string;
  updated_at: string;
};

export type EquipmentCommand = {
  id: string;
  clinic_id: string;
  equipment_id: string;
  command: EquipmentCommandType;
  parameters: Record<string, unknown> | null;
  issued_by_id: string;
  issued_at: string;
  status: CommandStatus;
  executed_at: string | null;
  error_message: string | null;
};

export type BmsAlert = {
  id: string;
  clinic_id: string;
  floor_id: string | null;
  bms_room_id: string | null;
  sensor_id: string | null;
  equipment_id: string | null;
  alert_type: BmsAlertType;
  severity: BmsAlertSeverity;
  title: string;
  message: string;
  status: BmsAlertStatus;
  acknowledged_by_id: string | null;
  acknowledged_at: string | null;
  resolved_by_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  room_name?: string;
  floor_name?: string;
  acknowledged_by_name?: string | null;
  resolved_by_name?: string | null;
};

export type AutomationRule = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  condition_sensor_type: BmsSensorType;
  condition_operator: ConditionOperator;
  condition_value: number;
  condition_floor_id: string | null;
  condition_room_id: string | null;
  action_equipment_type: EquipmentType | null;
  action_equipment_id: string | null;
  action_command: string;
  action_parameters: Record<string, unknown> | null;
  schedule_cron: string | null;
  schedule_description: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
};

export type AutomationLog = {
  id: string;
  rule_id: string;
  triggered_at: string;
  sensor_value: number | null;
  action_taken: string;
  success: boolean;
  error_message: string | null;
};

export type FloorStatus = {
  floor_id: string;
  floor_name: string;
  floor_number: number;
  avg_temperature: number | null;
  avg_humidity: number | null;
  avg_co2: number | null;
  active_alerts: number;
  worst_severity: BmsAlertSeverity | "NORMAL";
};

export type BmsDashboard = {
  sensor_count: number;
  active_sensors: number;
  active_alerts: number;
  alerts_by_severity: Record<string, number>;
  avg_temperature: number | null;
  energy_consumption: number | null;
  floor_statuses: FloorStatus[];
};

// ── WebSocket messages ──

export type WsSensorUpdate = {
  type: "sensor_update";
  sensor_id: string;
  sensor_type: BmsSensorType;
  value: number | null;
  value_text: string | null;
  unit: string;
  room_name: string;
  floor_id: string;
  floor: number;
  severity: BmsSensorSeverity;
};

export type WsAlertMessage = {
  type: "alert";
  alert: BmsAlert;
};

export type WsEquipmentUpdate = {
  type: "equipment_update";
  equipment_id: string;
  status: EquipmentStatus;
  parameters: Record<string, unknown> | null;
};

export type WsAutomationTriggered = {
  type: "automation_triggered";
  rule_name: string;
  action: string;
  room: string;
};

export type WsMessage =
  | WsSensorUpdate
  | WsAlertMessage
  | WsEquipmentUpdate
  | WsAutomationTriggered;
