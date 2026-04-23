import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Surgery {
  id: string;
  surgery_name: string;
  patient_id: string;
  patient_name: string;
  surgeon_id: string;
  surgeon_name: string;
  anesthesiologist_name: string | null;
  planned_date: string;
  actual_start: string | null;
  actual_end: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled" | "postponed";
  room: string | null;
  duration_minutes: number | null;
  protocol_text: string | null;
  complications: string | null;
  blood_loss_ml: number | null;
  implants: string | null;
  anesthesia_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSurgeryData {
  surgery_name: string;
  patient_id: string;
  planned_date: string;
  room?: string;
  anesthesia_type?: string;
  notes?: string;
}

export interface UpdateSurgeryData {
  surgery_name?: string;
  planned_date?: string;
  room?: string;
  protocol_text?: string;
  complications?: string;
  blood_loss_ml?: number;
  implants?: string;
}

export const useSurgeries = (status?: string) =>
  useQuery<Surgery[]>({
    queryKey: ["surgeries", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      const { data } = await apiClient.get(`/surgery/?${params}`);
      return data;
    },
  });

export const useCreateSurgery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSurgeryData) => {
      const { data } = await apiClient.post("/surgery/", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgeries"] }),
  });
};

export const useUpdateSurgery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSurgeryData & { id: string }) => {
      const { data } = await apiClient.patch(`/surgery/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgeries"] }),
  });
};

export const useStartSurgery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/surgery/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgeries"] }),
  });
};

export const useCompleteSurgery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/surgery/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgeries"] }),
  });
};

export const useCancelSurgery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/surgery/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgeries"] }),
  });
};
