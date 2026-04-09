import apiClient from "@/lib/api-client";

function portalHeaders() {
  const token = localStorage.getItem("portal_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const portalApi = {
  // Profile
  getProfile: () => apiClient.get("/portal/profile", { headers: portalHeaders() }).then(r => r.data),
  updateProfile: (data: { phone?: string; address?: string }) =>
    apiClient.patch("/portal/profile", data, { headers: portalHeaders() }).then(r => r.data),

  // Medical card
  getMedicalCard: () => apiClient.get("/portal/medical-card", { headers: portalHeaders() }).then(r => r.data),
  getVitals: (days = 30) => apiClient.get(`/portal/medical-card/vitals?days=${days}`, { headers: portalHeaders() }).then(r => r.data),
  getDiagnoses: () => apiClient.get("/portal/medical-card/diagnoses", { headers: portalHeaders() }).then(r => r.data),

  // Lab results
  getResults: () => apiClient.get("/portal/results", { headers: portalHeaders() }).then(r => r.data),
  getResultDetail: (id: string) => apiClient.get(`/portal/results/${id}`, { headers: portalHeaders() }).then(r => r.data),
  getResultTrend: (testId: string) => apiClient.get(`/portal/results/${testId}/trend`, { headers: portalHeaders() }).then(r => r.data),

  // Treatment
  getTreatment: () => apiClient.get("/portal/treatment", { headers: portalHeaders() }).then(r => r.data),
  getTodayTreatment: () => apiClient.get("/portal/treatment/today", { headers: portalHeaders() }).then(r => r.data),

  // Billing
  getBillingSummary: () => apiClient.get("/portal/billing/summary", { headers: portalHeaders() }).then(r => r.data),
  getInvoices: () => apiClient.get("/portal/billing/invoices", { headers: portalHeaders() }).then(r => r.data),
  getInvoiceDetail: (id: string) => apiClient.get(`/portal/billing/invoices/${id}`, { headers: portalHeaders() }).then(r => r.data),
  getPayments: () => apiClient.get("/portal/billing/payments", { headers: portalHeaders() }).then(r => r.data),

  // Appointments
  getAppointments: () => apiClient.get("/portal/appointments", { headers: portalHeaders() }).then(r => r.data),
  createAppointment: (data: Record<string, unknown>) =>
    apiClient.post("/portal/appointments", data, { headers: portalHeaders() }).then(r => r.data),
  cancelAppointment: (id: string) =>
    apiClient.delete(`/portal/appointments/${id}`, { headers: portalHeaders() }).then(r => r.data),
  getSlots: (doctorId: string, date: string) =>
    apiClient.get(`/portal/appointments/slots?doctor_id=${doctorId}&date=${date}`, { headers: portalHeaders() }).then(r => r.data),

  // Exercises
  getExercises: () => apiClient.get("/portal/exercises", { headers: portalHeaders() }).then(r => r.data),
  getExercise: (id: string) => apiClient.get(`/portal/exercises/${id}`, { headers: portalHeaders() }).then(r => r.data),
  createSession: (data: Record<string, unknown>) =>
    apiClient.post("/portal/exercises/sessions", data, { headers: portalHeaders() }).then(r => r.data),
  getSessions: () => apiClient.get("/portal/exercises/sessions", { headers: portalHeaders() }).then(r => r.data),
  getProgress: () => apiClient.get("/portal/exercises/progress", { headers: portalHeaders() }).then(r => r.data),

  // Messages
  getMessages: () => apiClient.get("/portal/messages", { headers: portalHeaders() }).then(r => r.data),
  sendMessage: (data: { recipient_id: string; content: string }) =>
    apiClient.post("/portal/messages", data, { headers: portalHeaders() }).then(r => r.data),
  getConversation: (userId: string) =>
    apiClient.get(`/portal/messages/${userId}`, { headers: portalHeaders() }).then(r => r.data),

  // Notifications
  getNotifications: () => apiClient.get("/portal/notifications", { headers: portalHeaders() }).then(r => r.data),
  markNotificationRead: (id: string) =>
    apiClient.patch(`/portal/notifications/${id}/read`, {}, { headers: portalHeaders() }).then(r => r.data),

  // Telemedicine
  getTelemedicine: () => apiClient.get("/portal/telemedicine", { headers: portalHeaders() }).then(r => r.data),
  joinTelemedicine: (id: string) => apiClient.get(`/portal/telemedicine/${id}/join`, { headers: portalHeaders() }).then(r => r.data),
};
