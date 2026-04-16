import apiClient from "@/lib/api-client";

export const laboratoryApi = {
  // Catalog
  getCatalog: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return apiClient.get(`/laboratory/catalog?${q}`).then((r) => r.data);
  },
  createTest: (data: Record<string, unknown>) =>
    apiClient.post("/laboratory/catalog", data).then((r) => r.data),
  updateTest: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/laboratory/catalog/${id}`, data).then((r) => r.data),
  deleteTest: (id: string) =>
    apiClient.delete(`/laboratory/catalog/${id}`).then((r) => r.data),

  // Orders
  getOrders: (params?: {
    patient_id?: string;
    status?: string;
    priority?: string;
    skip?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.patient_id) q.set("patient_id", params.patient_id);
    if (params?.status) q.set("status", params.status);
    if (params?.priority) q.set("priority", params.priority);
    if (params?.skip) q.set("skip", String(params.skip));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient.get(`/laboratory/orders?${q}`).then((r) => r.data);
  },
  getOrder: (id: string) =>
    apiClient.get(`/laboratory/orders/${id}`).then((r) => r.data),
  createOrder: (data: Record<string, unknown>) =>
    apiClient.post("/laboratory/orders", data).then((r) => r.data),
  updateOrder: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/laboratory/orders/${id}`, data).then((r) => r.data),

  // Results
  getResults: (params?: {
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
    return apiClient.get(`/laboratory/results?${q}`).then((r) => r.data);
  },
  createResult: (data: Record<string, unknown>) =>
    apiClient.post("/laboratory/results", data).then((r) => r.data),
  updateResult: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/laboratory/results/${id}`, data).then((r) => r.data),

  // Stats
  getStats: () =>
    apiClient.get("/laboratory/stats").then((r) => r.data),
};
