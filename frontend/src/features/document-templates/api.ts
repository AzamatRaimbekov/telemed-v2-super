import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  body_template: string;
  description: string | null;
  is_system_default: boolean;
  created_at: string;
}

export const useDocumentTemplates = () =>
  useQuery<DocumentTemplate[]>({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const { data } = await apiClient.get("/document-templates/");
      return data;
    },
  });

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; category: string; body_template: string; description?: string }) => {
      const { data } = await apiClient.post("/document-templates/", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
};

export const useRenderTemplate = () =>
  useMutation({
    mutationFn: async ({ id, context }: { id: string; context: { patient_id?: string; visit_id?: string; doctor_id?: string } }) => {
      const { data } = await apiClient.post(`/document-templates/${id}/render`, context);
      return data;
    },
  });
