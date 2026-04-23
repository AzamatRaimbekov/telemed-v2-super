import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface NurseDiaryEntry {
  id: string;
  patient_id: string;
  patient_name: string;
  nurse_id: string;
  nurse_name: string;
  shift: "day" | "evening" | "night";
  temperature: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  condition: "satisfactory" | "moderate" | "severe" | "critical";
  consciousness: string | null;
  complaints: string | null;
  procedures_done: string | null;
  medications_given: string | null;
  diet: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryData {
  patient_id: string;
  shift: string;
  temperature?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  condition: string;
  consciousness?: string;
  complaints?: string;
  procedures_done?: string;
  medications_given?: string;
  diet?: string;
  notes?: string;
}

export interface UpdateEntryData {
  temperature?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  condition?: string;
  notes?: string;
}

export const useNurseDiary = (patientId?: string) =>
  useQuery<NurseDiaryEntry[]>({
    queryKey: ["nurse-diary", patientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/nurse-diary/patient/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

export const useMyShift = () =>
  useQuery({
    queryKey: ["nurse-diary", "my-shift"],
    queryFn: async () => {
      const { data } = await apiClient.get("/nurse-diary/my-shift");
      return data;
    },
  });

export const useCreateEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEntryData) => {
      const { data } = await apiClient.post("/nurse-diary/", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-diary"] }),
  });
};

export const useUpdateEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateEntryData & { id: string }) => {
      const { data } = await apiClient.patch(`/nurse-diary/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-diary"] }),
  });
};
