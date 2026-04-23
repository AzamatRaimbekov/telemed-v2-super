import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to_id: string | null;
  assignee_name: string | null;
  created_by_id: string;
  patient_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TaskBoard = Record<string, StaffTask[]>;

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to_id?: string;
  patient_id?: string;
  due_date?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to_id?: string | null;
  due_date?: string | null;
}

export interface MoveTaskData {
  status: string;
  sort_order: number;
}

export const useTaskBoard = (assignedTo?: string) =>
  useQuery<TaskBoard>({
    queryKey: ["tasks", "board", assignedTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (assignedTo) params.set("assigned_to_id", assignedTo);
      const { data } = await apiClient.get(`/tasks/board?${params}`);
      return data;
    },
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTaskData) => {
      const { data } = await apiClient.post("/tasks/", body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTaskData & { id: string }) => {
      const { data } = await apiClient.patch(`/tasks/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

export const useMoveTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: MoveTaskData & { id: string }) => {
      const { data } = await apiClient.patch(`/tasks/${id}/move`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/tasks/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};
