import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ChangelogEntry {
  id: string;
  patient_id: string;
  changed_by_id: string;
  changed_by_name: string;
  action: "create" | "update" | "delete";
  entity_type: "patient" | "visit" | "prescription" | "lab_result";
  entity_id: string | null;
  changes: Record<string, { old: string; new: string }> | null;
  summary: string | null;
  created_at: string;
}

export const usePatientChangelog = (patientId: string, entityType?: string) =>
  useQuery<ChangelogEntry[]>({
    queryKey: ["changelog", patientId, entityType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      const { data } = await apiClient.get(
        `/patients/${patientId}/changelog?${params}`
      );
      return data;
    },
    enabled: !!patientId,
  });

export const useCreateChangelog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      ...body
    }: {
      patientId: string;
      action: string;
      entity_type: string;
      entity_id?: string;
      changes?: Record<string, { old: string; new: string }>;
      summary?: string;
    }) => {
      const { data } = await apiClient.post(
        `/patients/${patientId}/changelog`,
        body
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["changelog"] }),
  });
};
