import apiClient from "@/lib/api-client";

export const monitoringApi = {
  // Cameras
  getCameras: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/cameras`).then((r) => r.data),

  // Sensors
  getSensors: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/sensors`).then((r) => r.data),

  getCurrentReadings: (patientId: string) =>
    apiClient.get(`/monitoring/${patientId}/sensors/current`).then((r) => r.data),

  getSensorReadings: (patientId: string, sensorId: string, hours = 24) =>
    apiClient.get(`/monitoring/${patientId}/sensors/${sensorId}/readings?hours=${hours}`).then((r) => r.data),

  // Alerts
  getAlerts: (patientId: string, params?: { status?: string; severity?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/monitoring/${patientId}/alerts?${q}`).then((r) => r.data);
  },
  acknowledgeAlert: (alertId: string) =>
    apiClient.patch(`/monitoring/alerts/${alertId}/acknowledge`).then((r) => r.data),
  resolveAlert: (alertId: string) =>
    apiClient.patch(`/monitoring/alerts/${alertId}/resolve`).then((r) => r.data),

  // Nurse Calls
  getNurseCalls: (patientId: string, params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/monitoring/${patientId}/nurse-calls?${q}`).then((r) => r.data);
  },
  createNurseCall: (patientId: string) =>
    apiClient.post(`/monitoring/${patientId}/nurse-calls`).then((r) => r.data),
  acceptNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/accept`).then((r) => r.data),
  enRouteNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/en-route`).then((r) => r.data),
  onSiteNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/on-site`).then((r) => r.data),
  resolveNurseCall: (callId: string) =>
    apiClient.patch(`/monitoring/nurse-calls/${callId}/resolve`).then((r) => r.data),
};
