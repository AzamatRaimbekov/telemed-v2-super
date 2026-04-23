import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Referral {
  id: string;
  patient_id: string;
  patient_name: string;
  from_doctor_id: string;
  from_doctor_name: string;
  to_doctor_id: string | null;
  to_doctor_name: string | null;
  to_specialty: string;
  priority: "routine" | "urgent" | "emergency";
  status: "pending" | "accepted" | "declined" | "completed";
  reason: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReferralData {
  patient_id: string;
  to_specialty: string;
  priority: string;
  reason: string;
  notes?: string;
}

export const useReferrals = (filter?: string) =>
  useQuery<Referral[]>({
    queryKey: ["referrals", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) params.set("direction", filter);
      const { data } = await apiClient.get(`/referrals/?${params}`);
      return data;
    },
  });

export const useCreateReferral = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReferralData) => {
      const { data } = await apiClient.post("/referrals/", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });
};

export const useAcceptReferral = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/referrals/${id}/accept`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });
};

export const useDeclineReferral = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/referrals/${id}/decline`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });
};

export const useCompleteReferral = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/referrals/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });
};
