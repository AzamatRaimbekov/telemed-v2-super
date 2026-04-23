import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface QueueEntry {
  id: string;
  queue_number: number;
  patient_id: string;
  doctor_id: string | null;
  status:
    | "waiting"
    | "called"
    | "in_progress"
    | "completed"
    | "skipped"
    | "cancelled";
  room_name: string | null;
  display_name: string | null;
  called_at: string | null;
  created_at: string;
}

export const useTodayQueue = () =>
  useQuery<QueueEntry[]>({
    queryKey: ["queue", "today"],
    queryFn: async () => {
      const { data } = await apiClient.get("/queue/today");
      return data;
    },
    refetchInterval: 5000,
  });

export const useLobbyQueue = (clinicId: string) =>
  useQuery<QueueEntry[]>({
    queryKey: ["queue", "lobby", clinicId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/queue/lobby/${clinicId}`);
      return data;
    },
    refetchInterval: 3000,
  });

export const useAddToQueue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      patient_id: string;
      doctor_id?: string;
      room_name?: string;
      display_name?: string;
    }) => {
      const { data } = await apiClient.post("/queue/add", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
};

export const useCallNext = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doctor_id?: string) => {
      const { data } = await apiClient.post("/queue/call-next", { doctor_id });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
};

export const useQueueAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "start" | "complete" | "skip";
    }) => {
      const { data } = await apiClient.post(`/queue/${id}/${action}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
};
