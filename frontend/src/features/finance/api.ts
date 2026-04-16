// features/finance/api.ts — API client for billing/finance endpoints
import apiClient from "@/lib/api-client";

export const financeApi = {
  getStats: () => apiClient.get("/billing/stats").then((r) => r.data),

  getInvoices: (params?: {
    patient_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.patient_id) q.set("patient_id", params.patient_id);
    if (params?.status) q.set("status", params.status);
    if (params?.skip) q.set("skip", String(params.skip));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/billing/invoices?${q}`).then((r) => r.data);
  },

  getInvoice: (id: string) =>
    apiClient.get(`/billing/invoices/${id}`).then((r) => r.data),

  createInvoice: (data: Record<string, unknown>) =>
    apiClient.post("/billing/invoices", data).then((r) => r.data),

  updateInvoice: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/billing/invoices/${id}`, data).then((r) => r.data),

  deleteInvoice: (id: string) =>
    apiClient.delete(`/billing/invoices/${id}`).then((r) => r.data),

  getPayments: (params?: {
    patient_id?: string;
    skip?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.patient_id) q.set("patient_id", params.patient_id);
    if (params?.skip) q.set("skip", String(params.skip));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/billing/payments?${q}`).then((r) => r.data);
  },

  recordPayment: (data: Record<string, unknown>) =>
    apiClient.post("/billing/payments", data).then((r) => r.data),
};
