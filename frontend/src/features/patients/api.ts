import apiClient from "@/lib/api-client";

export const patientsApi = {
  list: (params: { skip?: number; limit?: number; search?: string; status?: string; doctor_id?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.skip) query.set("skip", String(params.skip));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.doctor_id) query.set("doctor_id", params.doctor_id);
    return apiClient.get(`/patients?${query}`).then(r => r.data);
  },
  get: (id: string) => apiClient.get(`/patients/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post("/patients", data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/patients/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/patients/${id}`).then(r => r.data),

  // Vitals
  getVitals: (patientId: string) => apiClient.get(`/patients/${patientId}/vitals`).then(r => r.data),
  addVitals: (patientId: string, data: Record<string, unknown>) => apiClient.post(`/patients/${patientId}/vitals`, data).then(r => r.data),

  // Lab results
  getLabResults: (patientId: string) => apiClient.get(`/patients/${patientId}/results`).then(r => r.data),
  approveResult: (resultId: string, visible: boolean) => apiClient.patch(`/patients/results/${resultId}/approve`, { visible_to_patient: visible }).then(r => r.data),

  // Treatment plans
  getTreatmentPlans: (patientId: string) => apiClient.get(`/patients/${patientId}/treatment-plans`).then(r => r.data),
  createTreatmentPlan: (patientId: string, data: Record<string, unknown>) => apiClient.post(`/patients/${patientId}/treatment-plans`, data).then(r => r.data),
  getTreatmentItems: (planId: string) => apiClient.get(`/patients/treatment-plans/${planId}/items`).then(r => r.data),
  addTreatmentItem: (data: Record<string, unknown>) => apiClient.post("/patients/treatment-plans/items", data).then(r => r.data),

  // Exercise sessions
  getExerciseSessions: (patientId: string) => apiClient.get(`/patients/${patientId}/exercise-sessions`).then(r => r.data),

  // Visits
  getVisits: (patientId: string) => apiClient.get(`/patients/${patientId}/visits`).then(r => r.data),

  // Registration helpers
  ocrPassport: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/ocr/passport", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },
  getDetectedFaces: (clinicId: string) => apiClient.get(`/camera/faces?clinic_id=${clinicId}`).then(r => r.data),
  validatePatient: (params: { inn?: string; passport_number?: string }) => apiClient.get("/patients/validate", { params }).then(r => r.data),
  getDoctorsWithLoad: () => apiClient.get("/doctors?with_load=true").then(r => r.data),
  getNurses: () => apiClient.get("/nurses").then(r => r.data),
  getDepartments: () => apiClient.get("/departments").then(r => r.data),
  getRooms: (departmentId: string) => apiClient.get(`/rooms?department_id=${departmentId}`).then(r => r.data),
  getBeds: (roomId: string) => apiClient.get(`/beds?room_id=${roomId}&status=AVAILABLE`).then(r => r.data),
  emergencyRegistration: (data: Record<string, unknown>) => apiClient.post("/patients/emergency", null, { params: data }).then(r => r.data),

  // User info
  getUser: (userId: string) => apiClient.get(`/users/${userId}`).then(r => r.data),
};
