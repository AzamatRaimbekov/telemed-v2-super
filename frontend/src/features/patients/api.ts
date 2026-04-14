import apiClient from "@/lib/api-client";

export const patientsApi = {
  list: (
    params: {
      skip?: number;
      limit?: number;
      search?: string;
      status?: string;
      doctor_id?: string;
    } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.skip) query.set("skip", String(params.skip));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.doctor_id) query.set("doctor_id", params.doctor_id);
    return apiClient.get(`/patients?${query}`).then((r) => r.data);
  },
  get: (id: string) => apiClient.get(`/patients/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post("/patients", data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/patients/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/patients/${id}`).then((r) => r.data),

  // Vitals
  getVitals: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/vitals`).then((r) => r.data),
  addVitals: (patientId: string, data: Record<string, unknown>) =>
    apiClient.post(`/patients/${patientId}/vitals`, data).then((r) => r.data),

  // Lab results
  getLabResults: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/results`).then((r) => r.data),
  approveResult: (resultId: string, visible: boolean) =>
    apiClient
      .patch(`/patients/results/${resultId}/approve`, {
        visible_to_patient: visible,
      })
      .then((r) => r.data),

  // Treatment plans
  getTreatmentPlans: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/treatment-plans`)
      .then((r) => r.data),
  createTreatmentPlan: (patientId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/patients/${patientId}/treatment-plans`, data)
      .then((r) => r.data),
  getTreatmentItems: (planId: string) =>
    apiClient
      .get(`/patients/treatment-plans/${planId}/items`)
      .then((r) => r.data),
  addTreatmentItem: (data: Record<string, unknown>) =>
    apiClient
      .post("/patients/treatment-plans/items", data)
      .then((r) => r.data),

  // Exercise sessions
  getExerciseSessions: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/exercise-sessions`)
      .then((r) => r.data),

  // Visits
  getVisits: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/visits`).then((r) => r.data),

  // Diagnoses
  getDiagnoses: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/diagnoses`).then((r) => r.data),

  // Procedure Orders
  getProcedureOrders: (patientId: string, status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiClient.get(`/patients/${patientId}/procedure-orders${q}`).then((r) => r.data);
  },
  getProcedureOrder: (patientId: string, orderId: string) =>
    apiClient.get(`/patients/${patientId}/procedure-orders/${orderId}`).then((r) => r.data),
  createProcedureOrder: (patientId: string, procedureId: string, scheduledAt?: string, notes?: string) => {
    const q = new URLSearchParams({ procedure_id: procedureId });
    if (scheduledAt) q.set("scheduled_at", scheduledAt);
    if (notes) q.set("notes", notes);
    return apiClient.post(`/patients/${patientId}/procedure-orders?${q}`).then((r) => r.data);
  },
  updateProcedureOrder: (patientId: string, orderId: string, params: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) q.set(k, String(v));
    }
    return apiClient.patch(`/patients/${patientId}/procedure-orders/${orderId}?${q}`).then((r) => r.data);
  },
  deleteProcedureOrder: (patientId: string, orderId: string) =>
    apiClient.delete(`/patients/${patientId}/procedure-orders/${orderId}`).then((r) => r.data),
  // Prescriptions
  getPrescriptions: (patientId: string, status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiClient.get(`/patients/${patientId}/prescriptions${q}`).then((r) => r.data);
  },
  getPrescription: (patientId: string, prescriptionId: string) =>
    apiClient.get(`/patients/${patientId}/prescriptions/${prescriptionId}`).then((r) => r.data),
  createPrescription: (patientId: string) =>
    apiClient.post(`/patients/${patientId}/prescriptions`).then((r) => r.data),
  addPrescriptionItem: (patientId: string, prescriptionId: string, params: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) q.set(k, String(v));
    }
    return apiClient.post(`/patients/${patientId}/prescriptions/${prescriptionId}/items?${q}`).then((r) => r.data);
  },
  updatePrescription: (patientId: string, prescriptionId: string, params: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) q.set(k, String(v));
    }
    return apiClient.patch(`/patients/${patientId}/prescriptions/${prescriptionId}?${q}`).then((r) => r.data);
  },
  deletePrescription: (patientId: string, prescriptionId: string) =>
    apiClient.delete(`/patients/${patientId}/prescriptions/${prescriptionId}`).then((r) => r.data),
  getDrugCatalog: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient.get(`/treatment/catalogs/drugs?${q}`).then((r) => r.data);
  },

  // Procedure catalog (for creating orders)
  getProcedureCatalog: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient.get(`/treatment/catalogs/procedures?${q}`).then((r) => r.data);
  },

  // Diagnoses CRUD (dedicated table)
  getDiagnosesList: (patientId: string, status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiClient.get(`/patients/${patientId}/diagnoses-list${q}`).then((r) => r.data);
  },
  getDiagnosisDetail: (patientId: string, diagnosisId: string) =>
    apiClient.get(`/patients/${patientId}/diagnoses-list/${diagnosisId}`).then((r) => r.data),
  createDiagnosis: (patientId: string, data: Record<string, unknown>) =>
    apiClient.post(`/patients/${patientId}/diagnoses-list`, data).then((r) => r.data),
  updateDiagnosis: (patientId: string, diagnosisId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/patients/${patientId}/diagnoses-list/${diagnosisId}`, data).then((r) => r.data),
  deleteDiagnosis: (patientId: string, diagnosisId: string) =>
    apiClient.delete(`/patients/${patientId}/diagnoses-list/${diagnosisId}`).then((r) => r.data),

  // Medical History
  getHistory: (
    patientId: string,
    params?: {
      entry_type?: string;
      period?: string;
      author_id?: string;
      skip?: number;
      limit?: number;
    }
  ) => {
    const query = new URLSearchParams();
    if (params?.entry_type) query.set("entry_type", params.entry_type);
    if (params?.period) query.set("period", params.period);
    if (params?.author_id) query.set("author_id", params.author_id);
    if (params?.skip) query.set("skip", String(params.skip));
    if (params?.limit) query.set("limit", String(params.limit));
    return apiClient
      .get(`/patients/${patientId}/history?${query}`)
      .then((r) => r.data);
  },
  getHistoryEntry: (patientId: string, entryId: string) =>
    apiClient
      .get(`/patients/${patientId}/history/${entryId}`)
      .then((r) => r.data),
  createHistoryEntry: (patientId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/patients/${patientId}/history`, data)
      .then((r) => r.data),
  updateHistoryEntry: (
    patientId: string,
    entryId: string,
    data: Record<string, unknown>
  ) =>
    apiClient
      .patch(`/patients/${patientId}/history/${entryId}`, data)
      .then((r) => r.data),
  deleteHistoryEntry: (patientId: string, entryId: string) =>
    apiClient
      .delete(`/patients/${patientId}/history/${entryId}`)
      .then((r) => r.data),
  verifyHistoryEntry: (patientId: string, entryId: string) =>
    apiClient
      .post(`/patients/${patientId}/history/${entryId}/verify`)
      .then((r) => r.data),
  getHistoryStats: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/history/stats`)
      .then((r) => r.data),

  // AI Document Analysis
  analyzeDocument: (patientId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patient_id", patientId);
    return apiClient
      .post("/ai/analyze-medical-document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // AI Audio upload
  uploadAudio: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    return apiClient
      .post("/ai/upload-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data as { url: string; filename: string; size: number });
  },

  // AI Speech-to-Text (Whisper)
  transcribeAudio: (audioBlob: Blob, language: string = "ru") => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("language", language);
    return apiClient
      .post("/ai/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      })
      .then((r) => r.data as { text: string; language: string });
  },

  // Room assignments
  getCurrentRoom: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/rooms/current`)
      .then((r) => r.data),
  getRoomHistory: (patientId: string, allHospitalizations?: boolean) => {
    const params = allHospitalizations ? "?all_hospitalizations=true" : "";
    return apiClient
      .get(`/patients/${patientId}/rooms/history${params}`)
      .then((r) => r.data);
  },
  transferRoom: (patientId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/patients/${patientId}/rooms/transfer`, data)
      .then((r) => r.data),
  getRoomAvailability: (roomId: string) =>
    apiClient.get(`/rooms/${roomId}/availability`).then((r) => r.data),

  // Registration helpers
  ocrPassport: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post("/ocr/passport", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  getDetectedFaces: (clinicId: string) =>
    apiClient
      .get(`/camera/faces?clinic_id=${clinicId}`)
      .then((r) => r.data),
  validatePatient: (params: { inn?: string; passport_number?: string }) =>
    apiClient.get("/patients/validate", { params }).then((r) => r.data),
  getDoctorsWithLoad: () =>
    apiClient.get("/doctors?with_load=true").then((r) => r.data),
  getNurses: () => apiClient.get("/nurses").then((r) => r.data),
  getDepartments: () => apiClient.get("/departments").then((r) => r.data),
  getRooms: (departmentId: string) =>
    apiClient
      .get(`/rooms?department_id=${departmentId}`)
      .then((r) => r.data),
  getBeds: (roomId: string) =>
    apiClient
      .get(`/beds?room_id=${roomId}&status=AVAILABLE`)
      .then((r) => r.data),
  emergencyRegistration: (data: Record<string, unknown>) =>
    apiClient
      .post("/patients/emergency", null, { params: data })
      .then((r) => r.data),

  // Treatment catalog + plan management (new /treatment/* endpoints)
  getTreatmentCatalogDrugs: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient.get(`/treatment/catalogs/drugs?${q}`).then((r) => r.data);
  },
  getTreatmentCatalogProcedures: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient
      .get(`/treatment/catalogs/procedures?${q}`)
      .then((r) => r.data);
  },
  getTreatmentCatalogLabTests: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient
      .get(`/treatment/catalogs/lab-tests?${q}`)
      .then((r) => r.data);
  },
  getTreatmentCatalogExercises: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient
      .get(`/treatment/catalogs/exercises?${q}`)
      .then((r) => r.data);
  },
  createTreatmentPlanFull: (data: Record<string, unknown>) =>
    apiClient.post("/treatment/plans", data).then((r) => r.data),
  getTreatmentPlanDetail: (planId: string) =>
    apiClient.get(`/treatment/plans/${planId}`).then((r) => r.data),
  updateTreatmentPlan: (planId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/treatment/plans/${planId}`, data).then((r) => r.data),
  deleteTreatmentPlan: (planId: string) =>
    apiClient.delete(`/treatment/plans/${planId}`).then((r) => r.data),
  activateTreatmentPlan: (planId: string) =>
    apiClient.post(`/treatment/plans/${planId}/activate`).then((r) => r.data),
  addTreatmentPlanItem: (planId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/treatment/plans/${planId}/items`, data)
      .then((r) => r.data),
  updateTreatmentPlanItem: (
    planId: string,
    itemId: string,
    data: Record<string, unknown>
  ) =>
    apiClient
      .patch(`/treatment/plans/${planId}/items/${itemId}`, data)
      .then((r) => r.data),
  deleteTreatmentPlanItem: (planId: string, itemId: string) =>
    apiClient
      .delete(`/treatment/plans/${planId}/items/${itemId}`)
      .then((r) => r.data),

  // Stroke Assessments
  getStrokeAssessments: (patientId: string, type?: string) => {
    const q = type ? `?assessment_type=${type}` : "";
    return apiClient
      .get(`/patients/${patientId}/stroke/assessments${q}`)
      .then((r) => r.data);
  },
  createStrokeAssessment: (patientId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/patients/${patientId}/stroke/assessments`, data)
      .then((r) => r.data),
  getLatestAssessments: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/assessments/latest`)
      .then((r) => r.data),
  updateStrokeAssessment: (
    patientId: string,
    id: string,
    data: Record<string, unknown>
  ) =>
    apiClient
      .patch(`/patients/${patientId}/stroke/assessments/${id}`, data)
      .then((r) => r.data),
  deleteStrokeAssessment: (patientId: string, id: string) =>
    apiClient
      .delete(`/patients/${patientId}/stroke/assessments/${id}`)
      .then((r) => r.data),

  // Rehab Goals
  getRehabGoals: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/goals`)
      .then((r) => r.data),
  createRehabGoal: (patientId: string, data: Record<string, unknown>) =>
    apiClient
      .post(`/patients/${patientId}/stroke/goals`, data)
      .then((r) => r.data),
  updateRehabGoal: (
    patientId: string,
    goalId: string,
    data: Record<string, unknown>
  ) =>
    apiClient
      .patch(`/patients/${patientId}/stroke/goals/${goalId}`, data)
      .then((r) => r.data),
  deleteRehabGoal: (patientId: string, goalId: string) =>
    apiClient
      .delete(`/patients/${patientId}/stroke/goals/${goalId}`)
      .then((r) => r.data),
  addGoalProgress: (
    patientId: string,
    goalId: string,
    data: Record<string, unknown>
  ) =>
    apiClient
      .post(`/patients/${patientId}/stroke/goals/${goalId}/progress`, data)
      .then((r) => r.data),
  getGoalProgress: (patientId: string, goalId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/goals/${goalId}/progress`)
      .then((r) => r.data),

  // Stroke exercises & progress
  getStrokeExercises: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/exercises`)
      .then((r) => r.data),
  getStrokeSessions: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/sessions`)
      .then((r) => r.data),
  getStrokeProgress: (patientId: string) =>
    apiClient
      .get(`/patients/${patientId}/stroke/progress`)
      .then((r) => r.data),

  // User info
  getUser: (userId: string) =>
    apiClient.get(`/users/${userId}`).then((r) => r.data),

  // Portal password
  resetPortalPassword: (patientId: string, newPassword: string) =>
    apiClient
      .post(`/patients/${patientId}/reset-portal-password`, {
        new_password: newPassword,
      })
      .then((r) => r.data),

  // Documents
  getDocuments: (patientId: string, category?: string) => {
    const q = category ? `?category=${category}` : "";
    return apiClient.get(`/patients/${patientId}/documents${q}`).then((r) => r.data);
  },
  uploadDocument: (patientId: string, file: File, title: string, category: string, description?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("category", category);
    if (description) formData.append("description", description);
    return apiClient.post(`/patients/${patientId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  deleteDocument: (patientId: string, documentId: string) =>
    apiClient.delete(`/patients/${patientId}/documents/${documentId}`).then((r) => r.data),

  // ICD-10 catalog
  searchIcd10: (query: string) =>
    apiClient.get(`/icd10/search?q=${encodeURIComponent(query)}`).then((r) => r.data as { code: string; title: string }[]),

  // Audit logs
  getAuditLogs: (
    patientId: string,
    params?: { skip?: number; limit?: number; action?: string }
  ) => {
    const query = new URLSearchParams();
    if (params?.skip) query.set("skip", String(params.skip));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.action) query.set("action", params.action);
    return apiClient
      .get(`/patients/${patientId}/audit-logs?${query}`)
      .then((r) => r.data);
  },
};
