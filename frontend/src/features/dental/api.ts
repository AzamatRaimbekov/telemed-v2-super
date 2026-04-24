import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------- Types ----------

export interface ToothData {
  status: string;
  notes: string;
  treatments: string[];
}

export interface DentalChart {
  id: string;
  patient_id: string;
  teeth: Record<string, ToothData>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToothTreatment {
  id: string;
  patient_id: string;
  tooth_number: number;
  doctor_id: string;
  procedure_name: string;
  diagnosis: string | null;
  tooth_status_before: string | null;
  tooth_status_after: string;
  materials_used: string | null;
  price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DentalProcedure {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface TreatmentCreateData {
  procedure_name: string;
  diagnosis?: string;
  tooth_status_after?: string;
  materials_used?: string;
  price?: number;
  notes?: string;
}

// ---------- Hooks ----------

export const useDentalChart = (patientId: string | undefined) =>
  useQuery<DentalChart>({
    queryKey: ["dental-chart", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dental/chart/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

export const useUpdateChart = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      ...body
    }: {
      patientId: string;
      teeth?: Record<string, ToothData>;
      notes?: string;
    }) => {
      const { data } = await apiClient.put(`/dental/chart/${patientId}`, body);
      return data;
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["dental-chart", vars.patientId] }),
  });
};

export const useAddTreatment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      toothNumber,
      ...body
    }: TreatmentCreateData & { patientId: string; toothNumber: number }) => {
      const { data } = await apiClient.post(
        `/dental/chart/${patientId}/tooth/${toothNumber}/treatment`,
        body
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dental-chart", vars.patientId] });
      qc.invalidateQueries({
        queryKey: ["tooth-history", vars.patientId, vars.toothNumber],
      });
      qc.invalidateQueries({
        queryKey: ["patient-treatments", vars.patientId],
      });
    },
  });
};

export const useToothHistory = (
  patientId: string | undefined,
  toothNumber: number | undefined
) =>
  useQuery<ToothTreatment[]>({
    queryKey: ["tooth-history", patientId, toothNumber],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/dental/chart/${patientId}/tooth/${toothNumber}/history`
      );
      return data;
    },
    enabled: !!patientId && toothNumber !== undefined,
  });

export const usePatientTreatments = (patientId: string | undefined) =>
  useQuery<ToothTreatment[]>({
    queryKey: ["patient-treatments", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dental/treatments/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

export const useDentalProcedures = (category?: string) =>
  useQuery<DentalProcedure[]>({
    queryKey: ["dental-procedures", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const { data } = await apiClient.get(`/dental/procedures?${params}`);
      return data;
    },
  });
