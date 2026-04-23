import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Infection {
  id: string;
  patient_id: string;
  patient_name: string;
  infection_type: string;
  status: "suspected" | "confirmed" | "monitoring" | "resolved";
  isolation_type: "contact" | "droplet" | "airborne" | "protective" | null;
  detected_date: string;
  resolved_date: string | null;
  room: string | null;
  precautions: string | null;
  notes: string | null;
  reported_by_id: string;
  reported_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReportInfectionData {
  patient_id: string;
  infection_type: string;
  isolation_type?: string;
  room?: string;
  precautions?: string;
  notes?: string;
}

export interface UpdateInfectionData {
  infection_type?: string;
  isolation_type?: string;
  status?: string;
  precautions?: string;
  notes?: string;
}

export const useInfections = (status?: string) =>
  useQuery<Infection[]>({
    queryKey: ["infections", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      const { data } = await apiClient.get(`/infection-control/?${params}`);
      return data;
    },
  });

export const useActiveCount = () =>
  useQuery<{ count: number }>({
    queryKey: ["infections", "active-count"],
    queryFn: async () => {
      const { data } = await apiClient.get("/infection-control/active-count");
      return data;
    },
  });

export const useQuarantineRooms = () =>
  useQuery<{ rooms: string[] }>({
    queryKey: ["infections", "quarantine-rooms"],
    queryFn: async () => {
      const { data } = await apiClient.get("/infection-control/quarantine-rooms");
      return data;
    },
  });

export const useReportInfection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReportInfectionData) => {
      const { data } = await apiClient.post("/infection-control/", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["infections"] });
    },
  });
};

export const useUpdateInfection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateInfectionData & { id: string }) => {
      const { data } = await apiClient.patch(`/infection-control/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["infections"] }),
  });
};

export const useResolveInfection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/infection-control/${id}/resolve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["infections"] }),
  });
};
