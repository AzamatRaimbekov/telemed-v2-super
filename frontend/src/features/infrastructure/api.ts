import apiClient from "@/lib/api-client";

export const infrastructureApi = {
  // ── Buildings ──
  getBuildings: () =>
    apiClient.get("/infrastructure/buildings").then((r) => r.data),

  createBuilding: (data: { name: string; address?: string; total_floors: number; description?: string }) =>
    apiClient.post("/infrastructure/buildings", data).then((r) => r.data),

  // ── Floors ──
  getFloors: (buildingId: string) =>
    apiClient.get(`/infrastructure/buildings/${buildingId}/floors`).then((r) => r.data),

  createFloor: (data: { building_id: string; floor_number: number; name: string; grid_cols?: number; grid_rows?: number }) =>
    apiClient.post("/infrastructure/floors", data).then((r) => r.data),

  updateFloor: (floorId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/floors/${floorId}`, data).then((r) => r.data),

  deleteFloor: (floorId: string) =>
    apiClient.delete(`/infrastructure/floors/${floorId}`).then((r) => r.data),

  // ── Zones ──
  createZone: (data: { floor_id: string; name: string; color: string }) =>
    apiClient.post("/infrastructure/zones", data).then((r) => r.data),

  updateZone: (zoneId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/zones/${zoneId}`, data).then((r) => r.data),

  deleteZone: (zoneId: string) =>
    apiClient.delete(`/infrastructure/zones/${zoneId}`).then((r) => r.data),

  // ── Rooms ──
  getRooms: (floorId: string) =>
    apiClient.get(`/infrastructure/floors/${floorId}/rooms`).then((r) => r.data),

  createRoom: (data: Record<string, unknown>) =>
    apiClient.post("/infrastructure/rooms", data).then((r) => r.data),

  updateRoom: (roomId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/rooms/${roomId}`, data).then((r) => r.data),

  deleteRoom: (roomId: string) =>
    apiClient.delete(`/infrastructure/rooms/${roomId}`).then((r) => r.data),

  // ── Sensors ──
  getFloorSensors: (floorId: string) =>
    apiClient.get(`/infrastructure/floors/${floorId}/sensors`).then((r) => r.data),

  getSensorReadings: (sensorId: string, hours = 24) =>
    apiClient.get(`/infrastructure/sensors/${sensorId}/readings?hours=${hours}`).then((r) => r.data),

  createSensor: (data: Record<string, unknown>) =>
    apiClient.post("/infrastructure/sensors", data).then((r) => r.data),

  updateSensor: (sensorId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/sensors/${sensorId}`, data).then((r) => r.data),

  deleteSensor: (sensorId: string) =>
    apiClient.delete(`/infrastructure/sensors/${sensorId}`).then((r) => r.data),

  // ── Equipment ──
  getFloorEquipment: (floorId: string) =>
    apiClient.get(`/infrastructure/floors/${floorId}/equipment`).then((r) => r.data),

  getRoomEquipment: (roomId: string) =>
    apiClient.get(`/infrastructure/rooms/${roomId}/equipment`).then((r) => r.data),

  createEquipment: (data: Record<string, unknown>) =>
    apiClient.post("/infrastructure/equipment", data).then((r) => r.data),

  updateEquipment: (equipmentId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/equipment/${equipmentId}`, data).then((r) => r.data),

  sendCommand: (equipmentId: string, data: { command: string; parameters?: Record<string, unknown> }) =>
    apiClient.post(`/infrastructure/equipment/${equipmentId}/command`, data).then((r) => r.data),

  getEquipmentCommands: (equipmentId: string) =>
    apiClient.get(`/infrastructure/equipment/${equipmentId}/commands`).then((r) => r.data),

  // ── Alerts ──
  getAlerts: (params?: { status?: string; severity?: string; floor_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.floor_id) q.set("floor_id", params.floor_id);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/infrastructure/alerts?${q}`).then((r) => r.data);
  },

  acknowledgeAlert: (alertId: string) =>
    apiClient.patch(`/infrastructure/alerts/${alertId}/acknowledge`).then((r) => r.data),

  resolveAlert: (alertId: string) =>
    apiClient.patch(`/infrastructure/alerts/${alertId}/resolve`).then((r) => r.data),

  // ── Automation ──
  getRules: () =>
    apiClient.get("/infrastructure/automation/rules").then((r) => r.data),

  createRule: (data: Record<string, unknown>) =>
    apiClient.post("/infrastructure/automation/rules", data).then((r) => r.data),

  updateRule: (ruleId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/infrastructure/automation/rules/${ruleId}`, data).then((r) => r.data),

  deleteRule: (ruleId: string) =>
    apiClient.delete(`/infrastructure/automation/rules/${ruleId}`).then((r) => r.data),

  toggleRule: (ruleId: string) =>
    apiClient.patch(`/infrastructure/automation/rules/${ruleId}/toggle`).then((r) => r.data),

  getRuleLogs: (ruleId: string) =>
    apiClient.get(`/infrastructure/automation/rules/${ruleId}/logs`).then((r) => r.data),

  // ── Dashboard ──
  getDashboard: () =>
    apiClient.get("/infrastructure/dashboard").then((r) => r.data),
};
