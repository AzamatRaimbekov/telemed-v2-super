import portalClient from "@/lib/portal-api-client";

export const portalApi = {
  // Profile
  getProfile: () => portalClient.get("/portal/profile").then(r => r.data),
  getFullProfile: () => portalClient.get("/portal/profile").then(r => r.data),
  updateProfile: (data: Record<string, unknown>) =>
    portalClient.patch("/portal/profile", data).then(r => r.data),

  // Medical card
  getMedicalCard: () => portalClient.get("/portal/medical-card").then(r => r.data),
  getVitals: (days = 30) => portalClient.get(`/portal/medical-card/vitals?days=${days}`).then(r => r.data),
  getDiagnoses: () => portalClient.get("/portal/medical-card/diagnoses").then(r => r.data),

  // Dashboard
  getDashboard: () => portalClient.get("/portal/dashboard").then(r => r.data),

  // Lab results
  getResults: () => portalClient.get("/portal/results").then(r => r.data),
  getResultDetail: (id: string) => portalClient.get(`/portal/results/${id}`).then(r => r.data),
  getResultTrend: (testId: string) => portalClient.get(`/portal/results/${testId}/trend`).then(r => r.data),

  // Treatment
  getTreatment: () => portalClient.get("/portal/treatment").then(r => r.data),
  getTodayTreatment: () => portalClient.get("/portal/treatment/today").then(r => r.data),
  getTreatmentPlans: () => portalClient.get("/portal/treatment-plans").then(r => r.data),
  getTreatmentPlan: (id: string) => portalClient.get(`/portal/treatment-plans/${id}`).then(r => r.data),
  confirmPrescription: (id: string) => portalClient.post(`/portal/prescriptions/${id}/confirm`, {}).then(r => r.data),

  // Schedule
  getSchedule: (from: string, to: string) => portalClient.get(`/portal/schedule?from=${from}&to=${to}`).then(r => r.data),
  getUpcomingEvents: () => portalClient.get("/portal/schedule/upcoming").then(r => r.data),

  // Billing
  getBillingSummary: () => portalClient.get("/portal/billing/summary").then(r => r.data),
  getInvoices: () => portalClient.get("/portal/billing/invoices").then(r => r.data),
  getInvoiceDetail: (id: string) => portalClient.get(`/portal/billing/invoices/${id}`).then(r => r.data),
  getPayments: () => portalClient.get("/portal/billing/payments").then(r => r.data),
  getBillingCategories: () => portalClient.get("/portal/billing/categories").then(r => r.data),

  // Appointments
  getAppointments: () => portalClient.get("/portal/appointments").then(r => r.data),
  createAppointment: (data: Record<string, unknown>) =>
    portalClient.post("/portal/appointments", data).then(r => r.data),
  cancelAppointment: (id: string) =>
    portalClient.delete(`/portal/appointments/${id}`).then(r => r.data),
  getSlots: (doctorId: string, date: string) =>
    portalClient.get(`/portal/appointments/slots?doctor_id=${doctorId}&date=${date}`).then(r => r.data),

  // Exercises
  getExercises: () => portalClient.get("/portal/exercises").then(r => r.data),
  getExercise: (id: string) => portalClient.get(`/portal/exercises/${id}`).then(r => r.data),
  getMyPrescribedExercises: async () => {
    try {
      return await portalClient.get("/portal/exercises/prescribed").then(r => r.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await portalClient.get("/portal/exercises").then(r => r.data);
      }
      throw err;
    }
  },
  createSession: (data: Record<string, unknown>) =>
    portalClient.post("/portal/exercises/sessions", data).then(r => r.data),
  getSessions: () => portalClient.get("/portal/exercises/sessions").then(r => r.data),
  getProgress: () => portalClient.get("/portal/exercises/progress").then(r => r.data),

  // History
  getVisits: (params?: { from?: string; to?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.search) query.set("search", params.search);
    return portalClient.get(`/portal/visits?${query}`).then(r => r.data);
  },
  getVisitDetail: (id: string) => portalClient.get(`/portal/visits/${id}`).then(r => r.data),
  getDocuments: () => portalClient.get("/portal/documents").then(r => r.data),

  // Messages
  getMessages: () => portalClient.get("/portal/messages").then(r => r.data),
  sendMessage: (data: { recipient_id: string; content: string }) =>
    portalClient.post("/portal/messages", data).then(r => r.data),
  getConversation: (userId: string) =>
    portalClient.get(`/portal/messages/${userId}`).then(r => r.data),

  // Notifications
  getNotifications: () => portalClient.get("/portal/notifications").then(r => r.data),
  markNotificationRead: (id: string) =>
    portalClient.patch(`/portal/notifications/${id}/read`, {}).then(r => r.data),

  // Recovery dynamics (portal-facing read-only)
  getRecoveryVitals: (days = 90) => portalClient.get(`/portal/recovery/vitals?days=${days}`).then(r => r.data),
  getRecoveryAssessments: () => portalClient.get("/portal/recovery/assessments").then(r => r.data),
  getRecoveryExerciseSessions: () => portalClient.get("/portal/recovery/exercise-sessions").then(r => r.data),
  getRecoveryLabResults: () => portalClient.get("/portal/recovery/lab-results").then(r => r.data),

  // Telemedicine
  getTelemedicine: () => portalClient.get("/portal/telemedicine").then(r => r.data),
  joinTelemedicine: (id: string) => portalClient.get(`/portal/telemedicine/${id}/join`).then(r => r.data),
};
