import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface VisitSummary {
  id: string;
  visit_id: string | null;
  patient_id: string;
  doctor_id: string;
  transcript: string | null;
  structured_summary: {
    chief_complaint: string | null;
    history_of_present_illness: string | null;
    examination: string | null;
    diagnosis: string | null;
    treatment_plan: string | null;
    recommendations: string | null;
    follow_up: string | null;
  } | null;
  ai_model_used: string | null;
  status: "processing" | "draft" | "approved" | "rejected";
  created_at: string;
}

export const useVisitSummaries = (params?: { patient_id?: string; status?: string }) =>
  useQuery<VisitSummary[]>({
    queryKey: ["visit-summaries", params],
    queryFn: async () => {
      const { data } = await apiClient.get("/visit-summaries/", { params });
      return data;
    },
  });

export const useVisitSummary = (id: string) =>
  useQuery<VisitSummary>({
    queryKey: ["visit-summary", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/visit-summaries/${id}`);
      return data;
    },
    enabled: !!id,
  });

export const useCreateSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patient_id: string; visit_id?: string; transcript: string }) => {
      const { data } = await apiClient.post("/visit-summaries/", body);
      return data as VisitSummary;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit-summaries"] }),
  });
};

export const useApproveSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/visit-summaries/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit-summaries"] }),
  });
};

export const useRejectSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/visit-summaries/${id}/reject`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit-summaries"] }),
  });
};
