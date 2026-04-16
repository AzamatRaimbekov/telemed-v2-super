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

export const settingsApi = {
  // Stats
  getStats: () =>
    apiClient.get("/settings/stats").then((r) => r.data),

  // ── Exercises ──────────────────────────────────────────────────────────────
  getExercises: (params?: {
    search?: string;
    category?: string;
    difficulty?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/settings/exercises${buildQuery(params)}`)
      .then((r) => r.data),

  createExercise: (data: Record<string, unknown>) =>
    apiClient.post("/settings/exercises", data).then((r) => r.data),

  getExercise: (id: string) =>
    apiClient.get(`/settings/exercises/${id}`).then((r) => r.data),

  updateExercise: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/settings/exercises/${id}`, data).then((r) => r.data),

  deleteExercise: (id: string) =>
    apiClient.delete(`/settings/exercises/${id}`).then((r) => r.data),

  toggleExercise: (id: string) =>
    apiClient.post(`/settings/exercises/${id}/toggle`).then((r) => r.data),

  importExercises: (data: Record<string, unknown>[]) =>
    apiClient.post("/settings/exercises/import", data).then((r) => r.data),

  // ── Drugs ──────────────────────────────────────────────────────────────────
  getDrugs: (params?: {
    search?: string;
    category?: string;
    form?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/settings/drugs${buildQuery(params)}`)
      .then((r) => r.data),

  createDrug: (data: Record<string, unknown>) =>
    apiClient.post("/settings/drugs", data).then((r) => r.data),

  getDrug: (id: string) =>
    apiClient.get(`/settings/drugs/${id}`).then((r) => r.data),

  updateDrug: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/settings/drugs/${id}`, data).then((r) => r.data),

  deleteDrug: (id: string) =>
    apiClient.delete(`/settings/drugs/${id}`).then((r) => r.data),

  toggleDrug: (id: string) =>
    apiClient.post(`/settings/drugs/${id}/toggle`).then((r) => r.data),

  getDrugCategories: () =>
    apiClient.get("/settings/drugs/categories").then((r) => r.data),

  // ── Procedures ─────────────────────────────────────────────────────────────
  getProcedures: (params?: {
    search?: string;
    category?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/settings/procedures${buildQuery(params)}`)
      .then((r) => r.data),

  createProcedure: (data: Record<string, unknown>) =>
    apiClient.post("/settings/procedures", data).then((r) => r.data),

  getProcedure: (id: string) =>
    apiClient.get(`/settings/procedures/${id}`).then((r) => r.data),

  updateProcedure: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/settings/procedures/${id}`, data).then((r) => r.data),

  deleteProcedure: (id: string) =>
    apiClient.delete(`/settings/procedures/${id}`).then((r) => r.data),

  getProcedureCategories: () =>
    apiClient.get("/settings/procedures/categories").then((r) => r.data),

  // ── Lab Tests ──────────────────────────────────────────────────────────────
  getLabTests: (params?: {
    search?: string;
    category?: string;
    skip?: number;
    limit?: number;
  }) =>
    apiClient
      .get(`/settings/lab-tests${buildQuery(params)}`)
      .then((r) => r.data),

  createLabTest: (data: Record<string, unknown>) =>
    apiClient.post("/settings/lab-tests", data).then((r) => r.data),

  getLabTest: (id: string) =>
    apiClient.get(`/settings/lab-tests/${id}`).then((r) => r.data),

  updateLabTest: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/settings/lab-tests/${id}`, data).then((r) => r.data),

  deleteLabTest: (id: string) =>
    apiClient.delete(`/settings/lab-tests/${id}`).then((r) => r.data),

  getLabTestCategories: () =>
    apiClient.get("/settings/lab-tests/categories").then((r) => r.data),
};
