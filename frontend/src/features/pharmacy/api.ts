// features/pharmacy/api.ts — API client for pharmacy module (inventory, dispensing, orders, suppliers)
import apiClient from "@/lib/api-client";

function buildQuery(params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, String(v));
    });
  }
  return q.toString() ? `?${q}` : "";
}

export const pharmacyApi = {
  // ── Dashboard ───────────────────────────────────────────────────────────────
  getDashboard: () =>
    apiClient.get("/pharmacy/dashboard").then((r) => r.data),

  // ── Inventory ───────────────────────────────────────────────────────────────
  getInventory: (params?: {
    search?: string;
    category?: string;
    form?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/pharmacy/inventory${buildQuery(params)}`)
      .then((r) => r.data),

  getBatches: (drugId: string) =>
    apiClient.get(`/pharmacy/inventory/${drugId}/batches`).then((r) => r.data),

  writeOff: (drugId: string, data: { batch_id: string; quantity: number; reason: string }) =>
    apiClient.post(`/pharmacy/inventory/${drugId}/write-off`, data).then((r) => r.data),

  adjust: (drugId: string, data: { batch_id: string; new_quantity: number; reason: string }) =>
    apiClient.post(`/pharmacy/inventory/${drugId}/adjust`, data).then((r) => r.data),

  // ── Dispensing ──────────────────────────────────────────────────────────────
  getPrescriptions: (params?: {
    search?: string;
    date_filter?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/pharmacy/prescriptions${buildQuery(params)}`)
      .then((r) => r.data),

  getPrescription: (id: string) =>
    apiClient.get(`/pharmacy/prescriptions/${id}`).then((r) => r.data),

  dispense: (id: string, data: { items: Array<{ item_id: string; batch_id: string; quantity: number }> }) =>
    apiClient.post(`/pharmacy/prescriptions/${id}/dispense`, data).then((r) => r.data),

  // ── Orders ──────────────────────────────────────────────────────────────────
  getOrders: (params?: {
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/pharmacy/orders${buildQuery(params)}`)
      .then((r) => r.data),

  getOrder: (id: string) =>
    apiClient.get(`/pharmacy/orders/${id}`).then((r) => r.data),

  createOrder: (data: Record<string, unknown>) =>
    apiClient.post("/pharmacy/orders", data).then((r) => r.data),

  updateOrder: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/pharmacy/orders/${id}`, data).then((r) => r.data),

  submitOrder: (id: string) =>
    apiClient.post(`/pharmacy/orders/${id}/submit`).then((r) => r.data),

  receiveOrder: (id: string, data: { items: Array<{ item_id: string; actual_quantity: number; batch_number: string; expiry_date: string }> }) =>
    apiClient.post(`/pharmacy/orders/${id}/receive`, data).then((r) => r.data),

  cancelOrder: (id: string) =>
    apiClient.post(`/pharmacy/orders/${id}/cancel`).then((r) => r.data),

  // ── Suppliers ───────────────────────────────────────────────────────────────
  getSuppliers: (params?: {
    search?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/pharmacy/suppliers${buildQuery(params)}`)
      .then((r) => r.data),

  createSupplier: (data: Record<string, unknown>) =>
    apiClient.post("/pharmacy/suppliers", data).then((r) => r.data),

  updateSupplier: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/pharmacy/suppliers/${id}`, data).then((r) => r.data),

  deleteSupplier: (id: string) =>
    apiClient.delete(`/pharmacy/suppliers/${id}`).then((r) => r.data),
};
