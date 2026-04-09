import apiClient from "@/lib/api-client";

export const staffApi = {
  // Staff
  list: (params: { skip?: number; limit?: number; search?: string; template_id?: string; department_id?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) query.set(k, String(v)); });
    return apiClient.get(`/staff?${query}`).then(r => r.data);
  },
  get: (id: string) => apiClient.get(`/staff/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post("/staff", data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/staff/${id}`, data).then(r => r.data),
  deactivate: (id: string) => apiClient.post(`/staff/${id}/deactivate`).then(r => r.data),
  resetPassword: (id: string) => apiClient.post(`/staff/${id}/reset-password`).then(r => r.data),
  getPermissions: (id: string) => apiClient.get(`/staff/${id}/permissions`).then(r => r.data),
  grantPermission: (id: string, data: { permission_code: string; reason?: string }) => apiClient.post(`/staff/${id}/permissions/grant`, data).then(r => r.data),
  revokePermission: (id: string, data: { permission_code: string; reason?: string }) => apiClient.post(`/staff/${id}/permissions/revoke`, data).then(r => r.data),
  changeTemplate: (id: string, templateId: string) => apiClient.patch(`/staff/${id}/template`, { template_id: templateId }).then(r => r.data),

  // Templates
  listTemplates: () => apiClient.get("/permission-templates").then(r => r.data),
  getTemplate: (id: string) => apiClient.get(`/permission-templates/${id}`).then(r => r.data),
  createTemplate: (data: Record<string, unknown>) => apiClient.post("/permission-templates", data).then(r => r.data),
  updateTemplate: (id: string, data: Record<string, unknown>) => apiClient.put(`/permission-templates/${id}`, data).then(r => r.data),
  deleteTemplate: (id: string) => apiClient.delete(`/permission-templates/${id}`).then(r => r.data),
  duplicateTemplate: (id: string) => apiClient.post(`/permission-templates/${id}/duplicate`).then(r => r.data),
  getTemplateFields: (id: string) => apiClient.get(`/permission-templates/${id}/fields`).then(r => r.data),

  // Permissions
  listPermissions: () => apiClient.get("/permissions").then(r => r.data),
  listPermissionGroups: () => apiClient.get("/permission-groups").then(r => r.data),
};
