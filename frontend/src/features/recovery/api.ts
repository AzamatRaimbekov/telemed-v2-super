import apiClient from "@/lib/api-client";

export const recoveryApi = {
  getGoals: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/recovery-goals`).then((r) => r.data),

  updateGoals: (patientId: string, goals: { domain: string; metric_key: string; target_value: number }[]) =>
    apiClient.put(`/patients/${patientId}/recovery-goals`, { goals }).then((r) => r.data),

  getWeights: (patientId: string) =>
    apiClient.get(`/patients/${patientId}/recovery-weights`).then((r) => r.data),

  updateWeights: (patientId: string, weights: { domain: string; weight: number }[]) =>
    apiClient.put(`/patients/${patientId}/recovery-weights`, { weights }).then((r) => r.data),
};
